import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function CopyLink({ label, token, open }: { label: string; token: string; open?: boolean }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/s/${token}`;
  return (
    <div>
      <div className="font-mono text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 flex gap-2">
        <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-xs">{url}</code>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        {open && (
          <Button asChild size="sm">
            <Link to="/s/$token" params={{ token }}>
              Open
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
