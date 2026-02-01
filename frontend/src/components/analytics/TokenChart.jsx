const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DATA = [
  { total: 40, input: 70, output: 30 },
  { total: 65, input: 60, output: 40 },
  { total: 30, input: 80, output: 20 },
  { total: 85, input: 65, output: 35 },
  { total: 50, input: 70, output: 30 },
  { total: 60, input: 75, output: 25 },
  { total: 20, input: 60, output: 40 },
];

export default function TokenChart() {
  return (
    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-bold">Daily Token Consumption</h3>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-brand-500" />
            Input
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Output
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2 border-b border-slate-800 relative">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
          <div className="w-full h-px bg-slate-600" />
          <div className="w-full h-px bg-slate-600" />
          <div className="w-full h-px bg-slate-600" />
          <div className="w-full h-px bg-slate-600" />
        </div>

        {DATA.map((d, i) => (
          <div
            key={i}
            className="w-full bg-slate-800 rounded-t flex flex-col justify-end group relative"
            style={{ height: `${d.total}%` }}
          >
            <div
              className="w-full bg-purple-500 opacity-80 rounded-t"
              style={{ height: `${d.output}%` }}
            />
            <div
              className="w-full bg-brand-500 opacity-80"
              style={{ height: `${d.input}%` }}
            />
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {d.total}k Tokens
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-2 font-mono">
        {DAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </div>
  );
}
