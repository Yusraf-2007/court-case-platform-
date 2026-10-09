import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

// Find a case by the number on the litigant's papers. A plain GET form to
// /search, so it works without JavaScript and the result URL can be shared.
export function CaseLookup({
  caseTypes,
  defaults = {},
  compact = false,
}: {
  caseTypes: { code: string; name: string }[];
  defaults?: { type?: string; number?: string; year?: string };
  compact?: boolean;
}) {
  return (
    <form action="/search" method="get" className="grid gap-4">
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="lookup-type" className="text-muted-foreground text-xs tracking-wide uppercase">
            Register
          </Label>
          <NativeSelect id="lookup-type" name="type" defaultValue={defaults.type ?? "GR"} className="h-11 text-base">
            {caseTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code}: {t.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lookup-number" className="text-muted-foreground text-xs tracking-wide uppercase">
            Number
          </Label>
          <Input
            id="lookup-number"
            name="number"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="412"
            defaultValue={defaults.number}
            className="h-11 text-base"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lookup-year" className="text-muted-foreground text-xs tracking-wide uppercase">
            Year
          </Label>
          <Input
            id="lookup-year"
            name="year"
            inputMode="numeric"
            pattern="[0-9]{4}"
            placeholder="2024"
            defaultValue={defaults.year}
            className="h-11 text-base"
          />
        </div>
      </div>
      <Button type="submit" size="lg" className={compact ? "" : "h-11 text-base"}>
        <SearchIcon /> Find my case
      </Button>
    </form>
  );
}
