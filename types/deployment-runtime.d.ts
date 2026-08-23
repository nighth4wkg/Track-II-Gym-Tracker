declare namespace Deno {
  namespace env {
    function get(name: string): string | undefined;
  }

  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

declare module "https://esm.sh/@supabase/supabase-js@2.111.0" {
  export * from "@supabase/supabase-js";
}
