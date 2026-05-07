export default function SkeletonRow({ cols = 5 }) {
  return (
    <tr className="animate-pulse border-b border-slate-800">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-slate-700 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}
