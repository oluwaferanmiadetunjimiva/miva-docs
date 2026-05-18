"use client";

import { generateExampleFromSchema } from "@/lib/generateExampleFromSchema";
import { prettyPayload } from "@/lib/helpers";
import type { OpenApiRequestBody } from "@/lib/openapiSpec";
import { createContext, useContext, useMemo, useState } from "react";

type PlaygroundBodyContextValue = {
  bodyText: string;
  setBodyText: (next: string) => void;
  prefilledFromExample: boolean;
  applyExample: (exampleText: string) => void;
};

const PlaygroundBodyContext = createContext<PlaygroundBodyContextValue | null>(null);

function extractSchemaRefName(ref: string): string | null {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  return match?.[1] ?? null;
}

function computeInitialBodyText(args: {
  method: string;
  requestBody?: OpenApiRequestBody;
  schemas?: Record<string, unknown>;
  seedSalt?: string;
}): string {
  const normalizedMethod = args.method.toLowerCase();
  if (normalizedMethod === "get") return "";
  if (!args.requestBody || !args.schemas) return "";

  const content = args.requestBody["content"] as Record<string, unknown> | undefined;
  const appJson = content?.["application/json"] as Record<string, unknown> | undefined;
  const schema = appJson?.["schema"] as Record<string, unknown> | undefined;
  if (!schema) return "";

  const ref = typeof schema["$ref"] === "string" ? (schema["$ref"] as string) : null;
  const refName = ref ? extractSchemaRefName(ref) : null;
  const resolved = refName ? (args.schemas[refName] as Record<string, unknown> | undefined) : schema;
  if (!resolved) return "";

  const salt = `${args.seedSalt ?? ""}:${refName ?? "inline"}`;
  const example = generateExampleFromSchema(resolved, args.schemas, salt);
  return prettyPayload(example);
}

type ProviderProps = {
  method: string;
  requestBody?: OpenApiRequestBody;
  schemas?: Record<string, unknown>;
  seedSalt?: string;
  children: React.ReactNode;
};

export function PlaygroundBodyProvider({ method, requestBody, schemas, seedSalt, children }: ProviderProps) {
  const [bodyText, setBodyTextState] = useState<string>(() =>
    computeInitialBodyText({ method, requestBody, schemas, seedSalt }),
  );
  const [prefilledFromExample, setPrefilledFromExample] = useState(false);

  const setBodyText = (next: string) => setBodyTextState(next);
  const applyExample = (exampleText: string) => {
    setBodyTextState(exampleText);
    setPrefilledFromExample(true);
  };

  const value = useMemo<PlaygroundBodyContextValue>(
    () => ({ bodyText, setBodyText, prefilledFromExample, applyExample }),
    [bodyText, prefilledFromExample],
  );

  return <PlaygroundBodyContext.Provider value={value}>{children}</PlaygroundBodyContext.Provider>;
}

export function usePlaygroundBody(): PlaygroundBodyContextValue {
  const ctx = useContext(PlaygroundBodyContext);
  if (!ctx) throw new Error("usePlaygroundBody must be used within PlaygroundBodyProvider");
  return ctx;
}

