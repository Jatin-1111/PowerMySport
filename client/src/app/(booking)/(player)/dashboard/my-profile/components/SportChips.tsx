export function SportChips({ sports }: { sports: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {sports.map((sport) => (
        <li
          key={sport}
          className="border-hairline text-ink rounded-md border bg-white px-3 py-1 text-sm"
        >
          {sport}
        </li>
      ))}
    </ul>
  );
}
