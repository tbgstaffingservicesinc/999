import { NextResponse } from "next/server";
import { createImportEngine } from "@/application/imports";
import type { ImportClientResolution, ImportFileFormat } from "@/modules/import";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurationErrorResponse } from "@/lib/http-configuration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const configurationError = supabaseConfigurationErrorResponse();
  if (configurationError) return configurationError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form." }, { status: 400 });
  }
  const upload = formData.get("file");
  if (!(upload instanceof File)) {
    return NextResponse.json({ error: "A CSV or XLSX file is required." }, { status: 400 });
  }
  const format = inferFormat(upload.name);
  if (!format) {
    return NextResponse.json({ error: "Only CSV and XLSX files are supported." }, { status: 415 });
  }

  const resolution = parseResolution(formData);
  if ("error" in resolution) return NextResponse.json({ error: resolution.error }, { status: 400 });

  const bytes = new Uint8Array(await upload.arrayBuffer());
  const engine = await createImportEngine();
  const result = await engine.saveDrafts({
    format,
    data: format === "csv" ? new TextDecoder().decode(bytes) : bytes,
    fileName: upload.name,
    mimeType: upload.type || undefined,
  }, { actorId: user.id, defaultResolution: resolution });
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "The import file contains no valid data rows." }, { status: 422 });
  }
  const rejected = result.rows.filter((row) => row.status === "rejected").length;
  return NextResponse.json(
    {
      import_operation_id: result.importOperationId,
      rows: result.rows,
      summary: {
        total: result.rows.length,
        imported: result.rows.length - rejected,
        rejected,
      },
    },
    { status: rejected === result.rows.length && rejected > 0 ? 422 : 201 },
  );
}

function inferFormat(fileName: string): ImportFileFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  return null;
}




function parseResolution(formData: FormData): ImportClientResolution | { error: string } {
  const modeValue = formData.get("client_resolution");
  const mode = typeof modeValue === "string" && modeValue.length > 0 ? modeValue : "CREATE_NEW";
  if (mode === "CREATE_NEW") return { mode };
  if (mode !== "LINK_EXISTING") return { error: "client_resolution must be CREATE_NEW or LINK_EXISTING." };
  const existingClientId = formData.get("existing_client_id");
  if (typeof existingClientId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existingClientId)) {
    return { error: "LINK_EXISTING requires a valid existing_client_id UUID." };
  }
  return { mode, existingClientId };
}

