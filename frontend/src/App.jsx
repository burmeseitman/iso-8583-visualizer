import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  CreditCard, Wallet, Terminal, FileText,
  AlertCircle, Activity, CheckCircle2,
  ChevronRight, Zap, ShieldCheck,
  Info, Clock, ArrowRight, BadgeCheck, XCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : 'http://localhost:8001';

/* ── Utility ─────────────────────────────── */
function formatPAN(pan) {
  if (!pan) return '•••• •••• •••• ••••';
  return pan.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/* ── Realistic Credit/Debit Card ─────────── */
function PaymentCard({ cardType, activeCard }) {
  const isCredit = cardType === 'credit';
  const gradient = isCredit
    ? 'from-violet-600 via-purple-600 to-fuchsia-500'
    : 'from-emerald-500 via-teal-500 to-cyan-500';
  const shadow = isCredit ? 'shadow-violet-300' : 'shadow-teal-300';

  return (
    <div className={`relative w-full max-w-[300px] mx-auto aspect-[1.586/1] rounded-[18px] p-5 flex flex-col justify-between text-white overflow-hidden shadow-xl ${shadow} bg-gradient-to-tr ${gradient} transition-all duration-700`}>
      {/* shine */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full border-[12px] border-white/15" />
      <div className="absolute top-8 -left-10 w-28 h-28 rounded-full border-[8px] border-white/10" />

      {/* Bank + contactless */}
      <div className="flex justify-between items-start relative z-10">
        <div>
          <div className="font-bold text-[11px] tracking-widest uppercase text-white/90">Nexus Bank</div>
          <div className="text-[9px] text-white/60 uppercase tracking-widest mt-0.5">{activeCard.type || 'Card'}</div>
        </div>
        <div className="flex items-end gap-[2px] opacity-80">
          {[6, 12, 16, 20].map((h, i) => (
            <div key={i} className="w-[3px] rounded-full bg-white" style={{ height: h, opacity: 0.3 + i * 0.2 }} />
          ))}
        </div>
      </div>

      {/* Chip */}
      <div className="relative z-10">
        <div className="w-10 h-8 rounded-md bg-gradient-to-br from-yellow-100 via-yellow-300 to-yellow-600 flex flex-col justify-evenly p-1 border border-yellow-500/40 opacity-95">
          <div className="w-full h-px bg-yellow-700/30" />
          <div className="w-full h-px bg-yellow-700/30" />
          <div className="w-full h-px bg-yellow-700/30" />
        </div>
      </div>

      {/* PAN */}
      <div className="relative z-10 font-mono text-[1.0rem] tracking-[0.18em] font-medium drop-shadow-md">
        {formatPAN(activeCard.pan)}
      </div>

      {/* Bottom */}
      <div className="flex justify-between items-end relative z-10">
        <div className="flex gap-5">
          <div>
            <div className="text-[7px] text-white/60 uppercase tracking-widest mb-0.5">Cardholder</div>
            <div className="text-[10px] font-semibold tracking-wider uppercase">ARYA STARK</div>
          </div>
          <div>
            <div className="text-[7px] text-white/60 uppercase tracking-widest mb-0.5">Valid Thru</div>
            <div className="text-[10px] font-semibold tracking-wider">{activeCard.expiry || '00/00'}</div>
          </div>
        </div>
        {/* brand circles */}
        <div className="relative flex items-center w-10 h-6">
          <div className="absolute w-6 h-6 rounded-full bg-red-500/90 right-3" />
          <div className="absolute w-6 h-6 rounded-full bg-amber-400/90 left-3 mix-blend-multiply" />
        </div>
      </div>
    </div>
  );
}

/* ── Panel Shell ─────────────────────────── */
function Panel({ accentClass, headerBg, icon, title, children, noPadBody = false }) {
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-white h-full">
      {/* Colored top stripe */}
      <div className={`h-1 w-full ${accentClass}`} />
      {/* Header */}
      <div className={`flex items-center gap-3 px-5 py-4 border-b border-slate-100 ${headerBg} flex-shrink-0`}>
        <div className="p-2 rounded-xl bg-white/70 shadow-sm">{icon}</div>
        <h2 className="font-bold text-sm text-slate-700 tracking-wide">{title}</h2>
      </div>
      {/* Body */}
      <div className={`flex-1 overflow-hidden flex flex-col ${noPadBody ? '' : 'p-5'}`}>
        {children}
      </div>
    </div>
  );
}

/* ── Main App ────────────────────────────── */
export default function App() {
  const [cardType, setCardType]       = useState('credit');
  const [amount, setAmount]           = useState('149.99');
  const [isProcessing, setProcessing] = useState(false);
  const [response, setResponse]       = useState(null);
  const [error, setError]             = useState(null);
  const [cards, setCards]             = useState({});

  useEffect(() => {
    axios.get(`${API_URL}/cards`)
      .then(r => setCards(r.data))
      .catch(e => console.error('Failed to fetch cards:', e));
  }, []);

  const handleTransaction = async () => {
    setProcessing(true);
    setResponse(null);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/generate`, {
        card_type: cardType,
        amount: parseFloat(amount),
      });
      res.data.status === 'SUCCESS' ? setResponse(res.data) : setError(res.data.reason);
    } catch {
      setError('Backend connection error. Make sure the Python server is running on port 8001.');
    } finally {
      setProcessing(false);
    }
  };

  const isCredit   = cardType === 'credit';
  const activeCard = cards[cardType] || {};
  const total      = isCredit ? activeCard.limit : activeCard.savings;
  const pct        = Math.min(((parseFloat(amount) || 0) / total) * 100, 100) || 0;

  return (
    /* root */
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">

      {/* ── Gradient rainbow top bar ───── */}
      <div className="h-[3px] bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 flex-shrink-0" />

      {/* ── App Shell Header ────────────── */}
      <header className="flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur border-b border-slate-200 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-300">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-black text-sm tracking-widest uppercase bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">ISO-8583 Visualizer</div>
            <div className="text-[9px] text-slate-400 uppercase tracking-widest">Interactive Transaction Simulator</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-semibold uppercase tracking-widest bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Backend Live
        </div>
      </header>

      {/* ── 3 Column Layout ─────────────── */}
      <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-hidden">

        {/* ═══════════════════════════════
             COLUMN 1 — Card Information
        ═══════════════════════════════ */}
        <Panel
          accentClass="bg-gradient-to-r from-violet-500 to-indigo-500"
          headerBg="bg-gradient-to-r from-violet-50 to-indigo-50"
          icon={<CreditCard className="w-4 h-4 text-violet-600" />}
          title="Card Information"
        >
          <div className="overflow-y-auto flex-1 flex flex-col gap-4">

            {/* Switcher */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
              {['credit', 'debit'].map(t => (
                <button
                  key={t}
                  onClick={() => { setCardType(t); setResponse(null); setError(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${
                    cardType === t
                      ? t === 'credit'
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-200'
                        : 'bg-teal-600 text-white shadow-md shadow-teal-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t === 'credit' ? <CreditCard className="w-3.5 h-3.5" /> : <Wallet className="w-3.5 h-3.5" />}
                  {t}
                </button>
              ))}
            </div>

            {/* Card */}
            <PaymentCard cardType={cardType} activeCard={activeCard} />

            {/* Balance bar */}
            <div className="bg-gradient-to-r from-slate-50 to-indigo-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">{isCredit ? 'Credit Limit' : 'Savings Balance'}</span>
                <span className={`text-lg font-extrabold ${isCredit ? 'text-violet-700' : 'text-teal-700'}`}>${total?.toLocaleString()}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                <div
                  style={{ width: `${pct}%` }}
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isCredit ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500' : 'bg-gradient-to-r from-emerald-400 to-cyan-500'
                  }`}
                />
              </div>
              <div className="text-[10px] text-right font-semibold text-slate-400">{pct.toFixed(1)}% {isCredit ? 'of credit limit' : 'of savings'}</div>
            </div>

            {/* Amount input */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-indigo-500 uppercase tracking-widest font-bold">Spend Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400 pointer-events-none">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 hover:border-indigo-300 focus:border-indigo-500 outline-none rounded-xl py-3 pl-9 pr-4 text-2xl font-bold text-slate-800 shadow-inner transition-all"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleTransaction}
              disabled={isProcessing}
              className={`w-full relative overflow-hidden group py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-300 active:scale-[0.97] shadow-md ${
                isProcessing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white hover:shadow-indigo-300 hover:shadow-lg'
              }`}
            >
              <div className="absolute inset-0 bg-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isProcessing ? <><Activity className="w-4 h-4 animate-spin" /> Processing...</> : <><Zap className="w-4 h-4" /> Generate ISO 8583</>}
              </span>
            </button>

            {/* ── Below Button Content ── */}
            <AnimatePresence mode="wait">
              {response ? (
                /* ── Transaction Result Summary ── */
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: 'spring', damping: 20 }}
                  className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Transaction Approved</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
                      <div className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Amount</div>
                      <div className="font-bold text-slate-700">${response.amount_processed}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
                      <div className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Card Type</div>
                      <div className="font-bold text-slate-700">{response.card_used}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
                      <div className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Payload</div>
                      <div className="font-bold text-slate-700">{response.hex.length / 2} bytes</div>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
                      <div className="text-slate-400 text-[9px] font-bold uppercase mb-0.5">Fields</div>
                      <div className="font-bold text-slate-700">{response.fields.length} DEs</div>
                    </div>
                  </div>
                </motion.div>
              ) : error ? (
                /* ── Error Summary ── */
                <motion.div
                  key="error-summary"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: 'spring', damping: 20 }}
                  className="bg-rose-50 border border-rose-200 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Declined</span>
                  </div>
                  <p className="text-[11px] text-rose-600 leading-relaxed">{error}</p>
                </motion.div>
              ) : (
                /* ── ISO 8583 Quick Reference ── */
                <motion.div
                  key="about"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200/60 rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3 h-3 text-indigo-500" />
                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">About ISO 8583</span>
                  </div>

                  <p className="text-[10px] text-slate-600 leading-snug">
                    The <span className="font-bold text-indigo-700">international standard</span> for payment card transaction messaging used by Visa, Mastercard and banks worldwide.
                  </p>

                  {/* Structure flow - single row */}
                  <div className="flex items-center gap-1 text-[8px]">
                    {['MTI', 'Bitmap', 'Data Elements'].map((label, i) => (
                      <span key={label} className="flex items-center gap-1">
                        {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-slate-300" />}
                        <span className={`px-1.5 py-0.5 rounded font-bold border ${
                          i === 0 ? 'bg-violet-100 text-violet-700 border-violet-200'
                          : i === 1 ? 'bg-pink-100 text-pink-700 border-pink-200'
                          : 'bg-teal-100 text-teal-700 border-teal-200'
                        }`}>{label}</span>
                      </span>
                    ))}
                  </div>

                  {/* Compact 2x2 facts */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Standard', value: 'ISO 8583:1987' },
                      { label: 'Max Fields', value: '128 DEs' },
                      { label: 'Used By', value: 'Visa · MC' },
                      { label: 'Encoding', value: 'BIN / ASCII' },
                    ].map(f => (
                      <div key={f.label} className="bg-white/70 rounded-md px-2 py-1.5 border border-slate-100">
                        <div className="text-[7px] text-slate-400 font-bold uppercase">{f.label}</div>
                        <div className="text-[9px] text-slate-700 font-semibold">{f.value}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>{/* end scrollable wrapper */}
        </Panel>

        {/* ═══════════════════════════════
             COLUMN 2 — ISO 8583 Messages
        ═══════════════════════════════ */}
        <Panel
          accentClass="bg-gradient-to-r from-pink-500 to-rose-500"
          headerBg="bg-gradient-to-r from-pink-50 to-rose-50"
          icon={<Terminal className="w-4 h-4 text-pink-600" />}
          title="ISO 8583 Messages"
          noPadBody
        >
          {/* macOS title bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <span className="text-slate-400 text-[10px] font-mono">iso8583.stream</span>
            <div className="w-10" />
          </div>

          {/* Terminal body */}
          <div className="flex-1 overflow-y-auto p-5 font-mono text-sm bg-slate-900 text-slate-300">
            {!response && !error && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-30">
                <Terminal className="w-14 h-14 text-slate-500" />
                <p className="text-xs uppercase tracking-[0.2em]">Waiting for transaction...</p>
              </div>
            )}

            <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-4"
              >
                <motion.div
                  initial={{ rotate: -10 }}
                  animate={{ rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="p-4 bg-rose-500/20 rounded-2xl border border-rose-500/30"
                >
                  <AlertCircle className="w-10 h-10 text-rose-400" />
                </motion.div>
                <h3 className="font-bold text-lg text-rose-400">DECLINED</h3>
                <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 py-3 px-4 rounded-xl max-w-xs leading-relaxed">{error}</p>
              </motion.div>
            )}

            {response && (
              <motion.div
                key="response"
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.15 } }
                }}
                className="space-y-5"
              >
                {/* Captured badge */}
                <motion.div
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', damping: 20 }}
                  className="inline-flex items-center gap-2 text-emerald-400 font-bold text-[10px] bg-emerald-400/10 px-3 py-1.5 rounded-lg border border-emerald-400/25"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> PACKET CAPTURED
                </motion.div>

                {/* HEX */}
                <motion.div
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', damping: 20 }}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 uppercase tracking-widest font-bold mb-2">
                    <ChevronRight className="w-3 h-3" /> Raw Hex Stream
                  </div>
                  <div className="bg-black/60 p-4 rounded-xl border border-slate-700 text-emerald-300 break-all leading-relaxed text-[11px]">
                    {response.hex}
                  </div>
                </motion.div>

                {/* Binary */}
                <motion.div
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', damping: 20 }}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-pink-400 uppercase tracking-widest font-bold mb-2">
                    <ChevronRight className="w-3 h-3" /> Binary Bitmap
                  </div>
                  <div className="bg-black/60 p-4 rounded-xl border border-slate-700 text-pink-200 break-all leading-tight text-[11px] h-28 overflow-y-auto">
                    {response.binary_preview}
                  </div>
                </motion.div>

                {/* Stats grid */}
                <motion.div
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', damping: 20 }}
                  className="grid grid-cols-2 gap-3"
                >
                  {[
                    { label: 'Payload Size', value: `${response.hex.length / 2} B`, cls: 'text-white' },
                    { label: 'MTI',          value: '0100',                         cls: 'text-cyan-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                      <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">{s.label}</div>
                      <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </Panel>

        {/* ═══════════════════════════════
             COLUMN 3 — Explanation
        ═══════════════════════════════ */}
        <Panel
          accentClass="bg-gradient-to-r from-teal-500 to-cyan-500"
          headerBg="bg-gradient-to-r from-teal-50 to-cyan-50"
          icon={<FileText className="w-4 h-4 text-teal-600" />}
          title="ISO 8583 Explanation"
        >
          <div className="overflow-y-auto flex-1 space-y-2.5">
            <AnimatePresence mode="wait">
            {!response ? (
              <motion.div
                key="pending"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-3"
              >
                <FileText className="w-14 h-14 text-slate-400" />
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Analysis pending...</p>
              </motion.div>
            ) : (
              <motion.div
                key="fields"
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
                }}
                className="flex flex-col gap-2.5"
              >
                {response.fields.map((f) => (
                  <motion.div
                    key={f.id}
                    variants={{
                      hidden: { opacity: 0, x: 30, scale: 0.95 },
                      visible: { opacity: 1, x: 0, scale: 1 }
                    }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md rounded-xl p-3.5 transition-all duration-200 group cursor-default"
                  >
                    <div className="mb-2">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        f.name === 'Bitmap'
                          ? 'bg-pink-100 text-pink-600'
                          : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {f.name === 'Bitmap' ? 'BITMAP' : `Field ${f.id}`}
                      </span>
                    </div>

                    <div className="text-[12px] font-bold text-slate-700 mb-2 group-hover:text-indigo-600 transition-colors">
                      {f.name}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-[11px] font-mono text-indigo-700 break-all">
                      {f.value}
                    </div>

                    <div className="mt-2.5 flex items-start gap-1.5 text-[10px] text-slate-500 border-t border-slate-100 pt-2.5 leading-relaxed">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f.desc}</span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </Panel>

      </div>
    </div>
  );
}
