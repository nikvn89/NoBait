import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calldataBytes, CALLDATA_LIMIT } from "./lib/calldata";
import { CONTRACT_ADDRESS, EXPLORER_BASE, SOURCE_SHA256 } from "./lib/config";
import { errorMessage } from "./lib/errors";
import { gen, parseGen } from "./lib/gen";
import {
  connectedWallet, getCredits, getLimits, getPiece, getSource, requestWallet, sendWrite, waitForVerdict,
} from "./lib/genlayer";
import { idsFromInput, pieceId, short } from "./lib/ids";
import {compatibleProfile, type Limits} from "./lib/parse";
import { pyLen, pyStrip } from "./lib/pytext";
import {
  challengeBlock, isAuthor, MAX_HEADLINE_LENGTH, MAX_URL_LENGTH, publishBlock, REVERTS, retireBlock, stampOf, UI,
  withdrawBlock,
} from "./lib/rules";
import type { Credits, Piece, Source, TxStatus } from "./lib/types";
import { challengeVerified, publishVerified, retireVerified, withdrawVerified, sourceVerified } from "./lib/verify";

type Verify = () => Promise<string | null>;
type View = "overview" | "front" | "publish" | "credits" | "verify";

const IDLE: TxStatus = { phase: "idle", message: "" };
const NAV: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "front", label: "Front Page", icon: "▤" },
  { id: "publish", label: "Publish", icon: "✎" },
  { id: "credits", label: "Credits", icon: "◎" },
  { id: "verify", label: "Verification", icon: "</>" },
];
const STORE_KEY = "nobait.v2."+CONTRACT_ADDRESS.toLowerCase();

function idsFromUrl(): string[] {
  return idsFromInput(new URLSearchParams(window.location.search).get("pieces") ?? "");
}

function rememberedIds(): string[] {
  try {
    return idsFromInput(window.localStorage.getItem(STORE_KEY) ?? "");
  } catch {
    return [];
  }
}

function saveIds(ids: string[]) {
  try {
    window.localStorage.setItem(STORE_KEY, ids.join(","));
  } catch {
    /* storage unavailable: the URL still carries the board */
  }
  const url = new URL(window.location.href);
  if (ids.length) url.searchParams.set("pieces", ids.join(","));
  else url.searchParams.delete("pieces");
  window.history.replaceState(null, "", url.toString());
}

export default function App() {
  const fromUrl = idsFromUrl();
  const [view, setView] = useState<View>(fromUrl.length ? "front" : "overview");
  const [me, setMe] = useState("");
  const [ids, setIds] = useState<string[]>(fromUrl.length ? fromUrl : rememberedIds());
  const [pieces, setPieces] = useState<Record<string, Piece | null>>({});
  const [credits, setCredits] = useState<Credits | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");

  const [headline, setHeadline] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sources,setSources]=useState<Record<string,Source>>({});
  const [selection,setSelection]=useState<Record<string,number>>({});
  const writeLock=useRef(false);
  const ready=compatibleProfile(limits);
  const [bondGen, setBondGen] = useState("");
  const [taken, setTaken] = useState(false);

  const [status, setStatus] = useState<TxStatus>(IDLE);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const recheck = useRef<Verify | null>(null);

  // ---------- reads ----------
  const loadCredits = useCallback(async (wallet: string) => {
    if (!wallet) return setCredits(null);
    try {
      setCredits(await getCredits(wallet));
    } catch {
      setCredits(null);
    }
  }, []);

  const loadPieces = useCallback(async (list: string[]) => {
    const entries = await Promise.all(list.map(async (id) => {
      try {
        return [id, await getPiece(id)] as const;
      } catch {
        return [id, null] as const;
      }
    }));
    setPieces((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  useEffect(() => {
    connectedWallet().then(setMe).catch(() => setMe(""));
    window.ethereum?.on?.("accountsChanged", (accounts: string[]) => {
      setMe((accounts?.[0] ?? "").toLowerCase());
      recheck.current = null;
      setStatus(IDLE);
      setFresh(null);
    });
    getLimits().then(setLimits).catch(() => setLimits(null));
  }, []);

  useEffect(() => {
    saveIds(ids);
    void loadPieces(ids);
  }, [ids, loadPieces]);

  useEffect(() => {
    void loadCredits(me);
  }, [me, loadCredits]);

  // ---------- derived ----------
  const bond = parseGen(bondGen);
  const newId = me && pyLen(pyStrip(headline)) > 0 && pyLen(pyStrip(sourceUrl)) > 0 ? pieceId(me, headline, sourceUrl) : "";
  useEffect(() => {
    let live = true;
    setTaken(false);
    if (!newId) return;
    const t = setTimeout(() => {
      getPiece(newId).then((p) => live && setTaken(!!p)).catch(() => undefined);
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [newId]);
  const publishBytes = useMemo(() => calldataBytes("publish", [headline, sourceUrl]), [headline, sourceUrl]);
  const publishReason = publishBlock({ me, headline, sourceUrl, bondWei: bond.ok ? bond.wei : null, exists: taken, bytes: publishBytes });
  const publishShown = publishReason === REVERTS.bondRange && bondGen && !bond.ok ? bond.reason : publishReason;
  const withdrawReason = withdrawBlock(me, credits);
  const board = ids.map((id) => [id, pieces[id]] as const);

  function reportError(e:unknown){setStatus({phase:"error",message:errorMessage(e)});}

  // ---------- writes ----------
  async function connect() {
    try {
      setMe(await requestWallet());
    } catch (e) {
      setStatus({ phase: "error", message: errorMessage(e) });
    }
  }

  async function runWrite(action: string, method: string, args: unknown[], value: bigint, verify: Verify) {
    if(writeLock.current||recheck.current||!ready)return;
    writeLock.current=true;
    setBusy(true);
    recheck.current = null;
    try {
      setStatus({ phase: "signing", message: "Confirm the transaction in your wallet…", action });
      const hash = await sendWrite(me, method, args, value);
      setStatus({ phase: "submitted", message: "Submitted. Waiting for validators to accept it…", hash, action });
      const verdict = await waitForVerdict(hash);
      if (verdict.kind === "error") {
        setStatus({ phase: "error", message: verdict.reason, hash, action });
        return;
      }
      if (verdict.kind === "pending") {
        recheck.current = async () => {const latest=await waitForVerdict(hash);if(latest.kind==="error")throw new Error(latest.reason);return latest.kind==="success"?verify():null;};
        setStatus({ phase: "delayed", message: "Submitted — confirmation delayed. Check again re-reads the accepted state; do not send it twice.", hash, action });
        return;
      }
      setStatus({ phase: "checking", message: "Executed. Reading the accepted state…", hash, action });
      const done = await verify();
      if (done) {
        setStatus({ phase: "success", message: done, hash, action });
      } else {
        recheck.current = async () => {const latest=await waitForVerdict(hash);if(latest.kind==="error")throw new Error(latest.reason);return latest.kind==="success"?verify():null;};
        setStatus({ phase: "delayed", message: "Executed, but the accepted state does not show the change yet. Check again in a moment.", hash, action });
      }
    } catch (e) {
      setStatus({ phase: "error", message: errorMessage(e), action });
    } finally {
      setBusy(false);
      writeLock.current=false;
    }
  }

  async function checkAgain() {
    const verify = recheck.current;
    if (!verify) return;
    setBusy(true);
    try {
      const done = await verify();
      if (done) {
        recheck.current = null;
        setStatus((s) => ({ ...s, phase: "success", message: done }));
      } else {
        setStatus((s) => ({ ...s, message: "The accepted state does not show the change yet. Try again shortly." }));
      }
    } catch (e) {
      recheck.current=null;
      setStatus((s) => ({ ...s, phase:"error", message: errorMessage(e) }));
    } finally {
      setBusy(false);
    }
  }

  function addToBoard(list: string[]) {
    setIds((prev) => [...list.filter((id) => !prev.includes(id)), ...prev]);
  }

  async function onPublish() {
    if (!bond.ok || publishReason) return;
    const id = pieceId(me, headline, sourceUrl);
    const s = { id, me, headline, sourceUrl, bondWei: bond.wei };
    if (await getPiece(id)) {
      setTaken(true);
      return;
    }
    await runWrite("Publish", "publish", [pyStrip(headline), pyStrip(sourceUrl)], bond.wei, async () => {
      const p = await getPiece(id);
      const snapshot=await getSource(id);
      if (!publishVerified(p, s)||!p||!sourceVerified(p,snapshot)) return null;
      setSources(prev=>({...prev,[id]:snapshot}));
      setPieces((prev) => ({ ...prev, [id]: p }));
      addToBoard([id]);
      setHeadline("");
      setSourceUrl("");
      setFresh(id);
      setView("front");
      return `Published, and the accepted state shows it: ${gen(s.bondWei)} bond held, open to one challenge. Copy the front-page link for challengers.`;
    });
  }

  async function onChallenge(p0: Piece) {
    // Probe the accepted state right before sending: the piece may already be ruled.
    const [p, mine] = await Promise.all([getPiece(p0.piece_id), getCredits(me)]);
    if (!p) return;
    setPieces((prev) => ({ ...prev, [p.piece_id]: p }));
    const index=selection[p.piece_id];
    const source=await getSource(p.piece_id);
    if (challengeBlock(p, me,index)||!sourceVerified(p,source)) return;
    const authorCredits=await getCredits(p.author);
    if(!mine||!authorCredits)throw new Error("Credit balances unavailable; refresh before signing.");
    const before = { piece: p, myCredits: mine, authorCredits, source, index };
    await runWrite("Challenge", "challenge", [p.piece_id, index], BigInt(p.bond_wei), async () => {
      const [after, c, authorCredits] = await Promise.all([getPiece(p.piece_id), getCredits(me),getCredits(p.author)]);
      const check = challengeVerified(before, { piece: after, myCredits: c, authorCredits }, me);
      if (!check.ok) return null;
      setPieces((prev) => ({ ...prev, [p.piece_id]: check.piece }));
      setCredits(c);
      setFresh(p.piece_id);
      const both = gen(2n * BigInt(p.bond_wei));
      if (check.piece.outcome === "OVERCLAIMS") return `Validators ruled OVERCLAIMS: the headline claims more than the committed source. Both bonds (${both}) are now your credits.`;
      if (check.piece.outcome === "WITHIN") return `Validators ruled WITHIN: the headline is supported by the committed source. Both bonds (${both}) went to the author.`;
      return `No usable ruling: the piece is VOID and each side got its own bond back (${gen(p.bond_wei)} to you).`;
    });
  }

  async function onRetire(p0: Piece) {
    const [p, mine] = await Promise.all([getPiece(p0.piece_id), getCredits(me)]);
    if (!p || retireBlock(p, me)) return;
    if(!mine)throw new Error("Credit balance unavailable; refresh before signing.");
    const before = { piece: p, myCredits: mine };
    await runWrite("Retire", "retire", [p.piece_id], 0n, async () => {
      const [after, c] = await Promise.all([getPiece(p.piece_id), getCredits(me)]);
      if (!retireVerified(before, { piece: after, myCredits: c })) return null;
      setPieces((prev) => ({ ...prev, [p.piece_id]: after }));
      setCredits(c);
      return `Piece retired; its ${gen(p.bond_wei)} bond is back in your credits.`;
    });
  }

  async function onWithdraw() {
    if (withdrawReason) return;
    const before = await getCredits(me);
    if(!before)throw new Error("Credit balance unavailable; refresh before signing.");
    await runWrite("Withdraw", "withdraw", [], 0n, async () => {
      const after = await getCredits(me);
      if (!withdrawVerified(before, after)) return null;
      setCredits(after);
      return `${gen(before!.credits)} withdrawal executed; credits are zero. Native delivery is checked separately through the explorer transfer.`;
    });
  }

  function onAdd() {
    const found = idsFromInput(addInput);
    if (!found.length) {
      setAddError("Paste a 64-character piece id, several ids, or a NoBait front-page link");
      return;
    }
    setAddError("");
    setAddInput("");
    addToBoard(found);
  }

  async function copyBoard() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus({ phase: "success", message: "Front-page link copied. It carries every piece on this board.", action: "Share" });
    } catch {
      setStatus({ phase: "error", message: "Could not copy; copy the address bar instead.", action: "Share" });
    }
  }

  async function loadSource(p:Piece) {
    try {const snapshot=await getSource(p.piece_id);if(!sourceVerified(p,snapshot))throw new Error("Snapshot hash or commitment mismatch; challenge disabled.");setSources(prev=>({...prev,[p.piece_id]:snapshot}));}
    catch(e){setStatus({phase:"error",message:errorMessage(e)});}
  }
  // ---------- pieces ----------
  function PieceCard({ id, p }: { id: string; p: Piece | null | undefined }) {
    if (p === undefined) return <article className="piece loading"><p className="muted mono">Reading {short(id, 8, 6)}…</p></article>;
    if (p === null) {
      return (
        <article className="piece missing">
          <p className="mono muted">{short(id, 10, 6)}</p>
          <p className="reason">{REVERTS.unknown}</p>
          <button className="btn btn-ghost" onClick={() => setIds((prev) => prev.filter((x) => x !== id))}>Remove</button>
        </article>
      );
    }
    const stamp = stampOf(p);
    const cReason = challengeBlock(p, me, selection[p.piece_id]);
    const mine = isAuthor(p, me);
    return (
      <article className={`piece tone-${stamp.tone} ${fresh === id ? "fresh" : ""}`}>
        <div className="piece-top">
          <span className="kicker">BY {short(p.author)}{mine ? " · YOU" : ""}</span>
          <span className={`stamp stamp-${stamp.tone}`}>{stamp.label}</span>
        </div>
        <h3 className="headline">{p.headline}</h3>
        <p><a href={p.source_url} target="_blank" rel="noreferrer">Open source URL ↗</a></p>
        <p className="fine mono">Snapshot hash: {p.source_hash}</p>
        <p className="fine mono">Verdict commitment: {p.commitment}</p>
        <button className="btn btn-ghost" disabled={busy} onClick={()=>void loadSource(p)}>Load committed source</button>
        {sources[id]&&<details className="snapshot" open={p.state==="OPEN"}>
          <summary>Committed source · {sources[id].passages.length} passages</summary>
          <p className="fine">Choose the source passage that challenges this headline. Validators read the complete snapshot, including other context. This view is frozen; the live URL may change.</p>
          {sources[id].passages.map((text,i)=><div className="source-passage" key={i}>
            {p.state==="OPEN"&&!mine?<label><input type="radio" name={`passage-${id}`} checked={selection[id]===i} onChange={()=>setSelection(prev=>({...prev,[id]:i}))}/> Passage #{i}</label>:<strong>Passage #{i}</strong>}
            <p>{text}</p></div>)}
        </details>}
        {p.challenger_quote&&<blockquote><strong>Challenger passage #{p.challenged_passage}</strong><p>{p.challenger_quote}</p></blockquote>}
        {p.cited_passages.length>0&&<div><strong>Validator supporting passages</strong>{p.cited_passages.map((text,i)=><blockquote key={i}><span>#{p.cited_indices[i]}</span><p>{text}</p></blockquote>)}</div>}
        <dl className="piece-facts">
          <div><dt>Bond</dt><dd className="mono">{gen(p.bond_wei)}</dd></div>
          <div><dt>Held now</dt><dd className="mono">{gen(p.held_wei)}</dd></div>
          <div><dt>Result</dt><dd>{stamp.who}</dd></div>
        </dl>
        {p.challenger && <p className="fine mono">challenger {short(p.challenger)}{p.challenger === me ? " (you)" : ""}</p>}
        <div className="piece-actions">
          {p.state === "OPEN" && (
            <span className="action">
              <button className="btn btn-primary" onClick={() => void onChallenge(p).catch(reportError)} disabled={busy || status.phase==="delayed" || !ready || !sources[id] || !!cReason}>
                Challenge · {gen(p.bond_wei)}
              </button>
              {cReason && p.state === "OPEN" && <span className="reason">{cReason}</span>}
            </span>
          )}
          {mine && p.state === "OPEN" && (
            <button className="btn btn-ghost" onClick={() => void onRetire(p).catch(reportError)} disabled={busy || status.phase==="delayed" || !ready || !!retireBlock(p, me)}>Retire</button>
          )}
          <a className="link mono" href={`${window.location.origin}/?pieces=${p.piece_id}`}>{short(p.piece_id, 8, 6)}</a>
        </div>
      </article>
    );
  }

  // ---------- view ----------
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img src="/logo-192.png" alt="" width={40} height={40} />
          <div>
            <div className="brand-name">No<span>Bait</span></div>
            <div className="brand-sub">HEADLINE VS. COMMITTED SOURCE</div>
          </div>
        </div>
        <div className="top-right">
          <div className="contract-chip">
            <span className="chip-tag">STUDIONET</span>
            <span className="dot" aria-hidden="true" />
            <div>
              <div className="chip-label">Contract</div>
              <div className="mono chip-value">{short(CONTRACT_ADDRESS, 6, 4)}</div>
            </div>
            <a className="chip-link" href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" aria-label="Open contract in explorer">↗</a>
          </div>
          {me ? (
            <div className="wallet-chip mono" title={me}><span className="dot" aria-hidden="true" />{short(me)}</div>
          ) : (
            <button className="btn btn-connect" onClick={connect}>▣ Connect wallet</button>
          )}
        </div>
      </header>

      <div className="body">
        <nav className="sidebar" aria-label="Sections">
          {NAV.map((n) => (
            <button key={n.id} className={`nav ${view === n.id ? "active" : ""}`} onClick={() => setView(n.id)}>
              <span className="nav-icon" aria-hidden="true">{n.icon}</span>
              {n.label}
              {view === n.id && <span className="nav-dot" aria-hidden="true" />}
            </button>
          ))}
          <div className="help">
            <p className="help-title">Need help?</p>
            <p>Validators fetch a source snapshot. Challengers select a source passage. Verdicts cite the same committed text.</p>
            <button className="btn btn-ghost wide" onClick={() => setView("overview")}>How it works</button>
          </div>
        </nav>

        <main className="main">
          {!ready&&<section className="panel"><strong>Source-backed V2 setup required</strong><p>Deploy HeadlineBound 2.0.0, set VITE_CONTRACT_ADDRESS and redeploy this app. Legacy v1 contracts are read-only here. Writes stay disabled until all source/citation capabilities are verified.</p><button className="btn btn-ghost" onClick={()=>void getLimits().then(setLimits).catch(reportError)}>Check deployment again</button></section>}
          <div className={`runtime runtime-${status.phase}`} aria-live="polite">
            <span className="dot" aria-hidden="true" />
            <span className="runtime-tag">{status.phase === "idle" ? "RUNTIME" : (status.action ?? "STATUS").toUpperCase()}</span>
            <span className="runtime-msg">
              {status.phase === "idle" ? "NoBait V2 · Connect a wallet or open a source-backed publication." : status.message}
            </span>
            {status.hash && (
              <a className="mono runtime-link" href={`${EXPLORER_BASE}/tx/${status.hash}`} target="_blank" rel="noreferrer">tx {short(status.hash, 10, 8)}</a>
            )}
            {status.phase === "delayed" && recheck.current && (
              <button className="btn btn-ghost small" onClick={checkAgain} disabled={busy}>Check again</button>
            )}
          </div>

          {view === "overview" && (
            <>
              <section className="panel hero">
                <img className="hero-logo" src="/logo.png" alt="" width={120} height={120} />
                <div className="hero-text">
                  <p className="eyebrow">GENLAYER · STUDIONET</p>
                  <h1>Headlines on a bond</h1>
                  <p className="hero-sub">A headline that claims more than the committed source <em>loses the bond.</em></p>
                  <p className="hero-body">
                    Validators fetch the source URL and commit a readable snapshot before a publication opens.
                    A challenger selects a passage from that snapshot. Validators read the whole source and cite
                    supporting passages before either bond is allocated. This checks source fidelity, not universal truth.
                  </p>
                  <div className="pills">
                    <span className="pill">✓ Source snapshot + hash</span>
                    <span className="pill">✓ Cited verdicts</span>
                    <span className="pill">✓ Unclear: both refunded</span>
                  </div>
                </div>
                <div className="contract-card">
                  <div className="cc-head"><span>Connected contract</span><span className="ready">{ready?"V2 verified":"Setup required"}</span></div>
                  <p className="mono cc-addr">{CONTRACT_ADDRESS}</p>
                  <div className="cc-foot">
                    <span><span className="dot" aria-hidden="true" /> StudioNet · 61999</span>
                    <a href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">View on Explorer ↗</a>
                  </div>
                </div>
              </section>

              <section className="panel steps">
                {[
                  ["1", "Publish with a bond", "The author supplies a headline and URL. Validators capture and hash the source, then lock the bond."],
                  ["2", "Challenge once", "A challenger selects a source passage and matches the bond; validators assess the full snapshot."],
                  ["3", "Winner takes both", "A conclusive cited ruling allocates both bonds; unclear refunds each side. Withdraw separately."],
                ].map(([n, t, d], i) => (
                  <div className="step" key={n}>
                    <span className="step-n">{n}</span>
                    <div><p className="step-t">{t}</p><p className="step-d">{d}</p></div>
                    {i < 2 && <span className="step-arrow" aria-hidden="true">›</span>}
                  </div>
                ))}
              </section>

              <section className="cards">
                <div className="panel card">
                  <p className="eyebrow muted">OVERCLAIMS</p>
                  <h2>The headline says more.</h2>
                  <p>"Compound slows tumour growth by a third" against a source snapshot about mice. The challenger takes both bonds and the piece keeps the stamp for good.</p>
                  <div className="tags"><span className="tag tag-over">RULED_OVERCLAIMS</span></div>
                </div>
                <div className="panel card">
                  <p className="eyebrow muted">WITHIN</p>
                  <h2>The headline stays inside.</h2>
                  <p>"Compound slows tumour growth in mice" against the same committed source. The author takes both bonds and the piece cannot be challenged again.</p>
                  <div className="tags"><span className="tag tag-within">RULED_WITHIN</span></div>
                </div>
                <div className="panel card">
                  <p className="eyebrow muted">VOID</p>
                  <h2>No usable reading, no loser.</h2>
                  <p>If validators cannot give a usable answer, each side gets its own bond back. Every write is confirmed against the re-read contract state.</p>
                  <div className="tags"><span className="tag tag-void">VOID</span><span className="tag">RETIRED</span></div>
                </div>
              </section>
            </>
          )}

          {view === "front" && (
            <>
              <section className="panel section-head">
                <div>
                  <p className="eyebrow">FRONT PAGE</p>
                  <h1>Pieces on this board</h1>
                  <p className="muted">Each headline is bound to an independently fetched source snapshot. Load the committed source and choose a passage to challenge.</p>
                </div>
                <button className="btn btn-ghost" onClick={copyBoard} disabled={!ids.length}>Copy front-page link</button>
              </section>
              <form className="adder" onSubmit={(e) => { e.preventDefault(); onAdd(); }}>
                <input aria-label="Piece ids or link" placeholder="Paste piece ids or a NoBait link" value={addInput} onChange={(e) => setAddInput(e.target.value)} spellCheck={false} />
                <button className="btn btn-primary" type="submit">Add</button>
              </form>
              {addError && <p className="reason">{addError}</p>}
              {board.length === 0 && <section className="panel empty"><p className="muted">No pieces yet. Publish one, or paste a link someone shared.</p></section>}
              <div className="board">
                {board.map(([id, p]) => <PieceCard key={id} id={id} p={p} />)}
              </div>
            </>
          )}

          {view === "publish" && (
            <section className="panel form">
              <p className="eyebrow">PUBLISH</p>
              <h1>Put a headline on a bond</h1>
              <p className="muted">Enter the original article URL and headline. Validators fetch and agree on the full readable text; no author summary is accepted. Unavailable or unstable pages fail publication. Your bond stays open to one source-backed challenge.</p>
              <label htmlFor="sourceUrl">Original source URL (HTTPS)</label>
              <input id="sourceUrl" type="url" placeholder="https://publisher.example/article" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
              <span className="fine">{pyLen(pyStrip(sourceUrl))} / {MAX_URL_LENGTH} characters</span>
              <label htmlFor="headline">Headline</label>
              <input id="headline" placeholder="The headline readers see first." value={headline} onChange={(e) => setHeadline(e.target.value)} />
              <span className="fine">{pyLen(pyStrip(headline))} / {MAX_HEADLINE_LENGTH} characters</span>
              <label htmlFor="bond">Bond (GEN)</label>
              <input id="bond" inputMode="decimal" placeholder="0.01" value={bondGen} onChange={(e) => setBondGen(e.target.value)} />
              <span className="fine">Between 0.001 and 1 GEN. A challenger must put down exactly the same.</span>
              <div className="form-foot">
                <span className={`meter mono ${publishBytes > CALLDATA_LIMIT ? "over" : ""}`}>{publishBytes} / {CALLDATA_LIMIT} bytes</span>
                <span className="action">
                  {(headline || sourceUrl || bondGen) && publishShown && <span className="reason">{publishShown}</span>}
                  <button className="btn btn-primary" onClick={() => void onPublish().catch(reportError)} disabled={busy || status.phase==="delayed" || !ready || !!publishReason || !bond.ok}>Publish</button>
                </span>
              </div>
              {newId && <p className="fine mono">Piece id: {newId}</p>}
            </section>
          )}

          {view === "credits" && (
            <section className="panel form">
              <p className="eyebrow">CREDITS</p>
              <h1>Your credits</h1>
              {!me && <p className="muted">{UI.noWallet}.</p>}
              {me && (
                <>
                  <div className="credit-big mono">{gen(credits?.credits ?? "0")}</div>
                  <p className="muted">Held by the contract: bonds you won, bonds refunded by a VOID ruling, and bonds of pieces you retired. Only you can withdraw them.</p>
                </>
              )}
              <span className="action">
                <button className="btn btn-primary" onClick={() => void onWithdraw().catch(reportError)} disabled={busy || status.phase==="delayed" || !ready || !!withdrawReason}>Withdraw</button>
                {me && withdrawReason && <span className="reason">{withdrawReason}</span>}
              </span>
            </section>
          )}

          {view === "verify" && (
            <section className="panel form">
              <p className="eyebrow">VERIFICATION</p>
              <h1>What you are talking to</h1>
              <dl className="facts">
                <div><dt>Contract</dt><dd className="mono"><a href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">{CONTRACT_ADDRESS}</a></dd></div>
                <div><dt>Source SHA-256</dt><dd className="mono">{SOURCE_SHA256}</dd></div>
                <div><dt>Contract name · version</dt><dd className="mono">{limits ? `${limits.contract_name ?? "?"} · ${limits.version ?? "?"}` : "reading…"}</dd></div>
                <div><dt>Rubric hash (from get_limits)</dt><dd className="mono">{limits?.rubric_hash ?? "reading…"}</dd></div>
                <div><dt>Bond range</dt><dd className="mono">{limits?.min_bond_wei ? `${gen(limits.min_bond_wei)} – ${gen(limits.max_bond_wei ?? "0")}` : "reading…"}</dd></div>
              </dl>
              <p className="muted">
                Every revert the app can predict disables the button and shows the contract's own sentence. Whether a headline
                overclaims is decided only by validators inside challenge(); the app reads the stamp back from the contract.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
