type ClipboardLike = {
  writeText?: (value: string) => Promise<void>;
};

type NavigatorLike = {
  clipboard?: ClipboardLike;
};

type TextareaLike = {
  value: string;
  style: {
    position?: string;
    top?: string;
    left?: string;
  };
  select: () => void;
  setSelectionRange?: (start: number, end: number) => void;
  remove: () => void;
};

type DocumentLike = {
  body?: {
    appendChild: (node: unknown) => unknown;
  };
  createElement: (tagName: "textarea") => TextareaLike;
  execCommand?: (command: "copy") => boolean;
};

type CopyEnvironment = {
  navigator?: NavigatorLike;
  document?: DocumentLike;
};

function getDefaultEnvironment(): CopyEnvironment {
  return {
    navigator: typeof navigator === "undefined" ? undefined : navigator,
    document: typeof document === "undefined" ? undefined : document,
  };
}

export async function copyText(value: string, environment: CopyEnvironment = getDefaultEnvironment()) {
  const clipboard = environment.navigator?.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(value);
      return true;
    } catch {
      // In insecure contexts (for example http://IP), browsers may reject clipboard access.
    }
  }

  const fallbackDocument = environment.document;
  if (!fallbackDocument?.body || !fallbackDocument.execCommand) return false;

  const textarea = fallbackDocument.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  fallbackDocument.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange?.(0, value.length);

  try {
    return fallbackDocument.execCommand("copy");
  } finally {
    textarea.remove();
  }
}
