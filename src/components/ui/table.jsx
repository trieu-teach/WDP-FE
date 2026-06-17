export function Table({ children, className }) {
  return (
    <div className={`w-full overflow-auto ${className || ''}`}>
      <table className="w-full caption-bottom text-sm">{children}</table>
    </div>
  )
}

export function TableHeader({ children, className }) {
  return <thead className={`border-b ${className || ''}`}>{children}</thead>
}

export function TableBody({ children, className }) {
  return <tbody className={`[&_tr:last-child]:border-0 ${className || ''}`}>{children}</tbody>
}

export function TableRow({ children, className }) {
  return <tr className={`border-b transition-colors hover:bg-muted/50 ${className || ''}`}>{children}</tr>
}

export function TableHead({ children, className }) {
  return <th className={`h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 ${className || ''}`}>{children}</th>
}

export function TableCell({ children, className }) {
  return <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className || ''}`}>{children}</td>
}
