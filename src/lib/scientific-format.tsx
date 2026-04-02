import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import katex from "katex";

import { splitMathSegments } from "@/lib/export-content";

const SCIENTIFIC_PATTERN =
  /([A-Za-z0-9/)\]]+)\^\{([^}]+)\}|([A-Za-z0-9/)\]]+)_\{([^}]+)\}|([A-Za-z0-9/)\]]+)\^([A-Za-z0-9+\-*/=().]+)|([A-Za-z0-9/)\]]+)_([A-Za-z0-9+\-*/=().]+)|(\b(?=[A-Za-z0-9]*\d)(?:[A-Z][a-z]?\d*)+\b)/g;

function renderChemicalFormula(token: string, keyPrefix: string) {
  const parts: ReactNode[] = [];
  const digitPattern = /\d+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = digitPattern.exec(token)) !== null) {
    if (match.index > lastIndex) {
      parts.push(token.slice(lastIndex, match.index));
    }

    parts.push(<sub key={`${keyPrefix}-sub-${match.index}`}>{match[0]}</sub>);
    lastIndex = digitPattern.lastIndex;
  }

  if (lastIndex < token.length) {
    parts.push(token.slice(lastIndex));
  }

  return parts;
}

function formatScientificText(value: string) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  SCIENTIFIC_PATTERN.lastIndex = 0;

  while ((match = SCIENTIFIC_PATTERN.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }

    const keyBase = `${match.index}-${match[0]}`;
    const braceSupBase = match[1];
    const braceSupValue = match[2];
    const braceSubBase = match[3];
    const braceSubValue = match[4];
    const supBase = match[5];
    const supValue = match[6];
    const subBase = match[7];
    const subValue = match[8];
    const chemical = match[9];

    if (braceSupBase && braceSupValue) {
      nodes.push(braceSupBase);
      nodes.push(<sup key={`${keyBase}-sup`}>{braceSupValue}</sup>);
    } else if (braceSubBase && braceSubValue) {
      nodes.push(braceSubBase);
      nodes.push(<sub key={`${keyBase}-sub`}>{braceSubValue}</sub>);
    } else if (supBase && supValue) {
      nodes.push(supBase);
      nodes.push(<sup key={`${keyBase}-sup`}>{supValue}</sup>);
    } else if (subBase && subValue) {
      nodes.push(subBase);
      nodes.push(<sub key={`${keyBase}-sub`}>{subValue}</sub>);
    } else if (chemical) {
      nodes.push(...renderChemicalFormula(chemical, keyBase));
    } else {
      nodes.push(match[0]);
    }

    lastIndex = SCIENTIFIC_PATTERN.lastIndex;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
}

function renderMath(value: string, displayMode: boolean, key: string) {
  const html = katex.renderToString(value, {
    displayMode,
    throwOnError: false,
  });

  return (
    <span
      key={key}
      className={displayMode ? "katex-block" : "katex-inline"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function formatScientificString(value: string) {
  const nodes: ReactNode[] = [];
  const segments = splitMathSegments(value);

  segments.forEach((segment, index) => {
    if (segment.type === "text") {
      nodes.push(...formatScientificText(segment.value));
      return;
    }

    nodes.push(renderMath(segment.value, segment.displayMode, `math-${index}-${segment.value}`));
  });

  return nodes;
}

export function formatScientificContent(content: ReactNode): ReactNode {
  return Children.map(content, (child) => {
    if (typeof child === "string") {
      const nodes = formatScientificString(child);
      return <Fragment>{nodes}</Fragment>;
    }

    if (typeof child === "number") {
      return child;
    }

    if (!isValidElement(child)) {
      return child;
    }

    if (
      typeof child.type === "string" &&
      ["code", "pre", "script", "style", "sup", "sub"].includes(child.type)
    ) {
      return child;
    }

    const element = child as ReactElement<{ children?: ReactNode }>;
    const children = element.props.children;

    return cloneElement(element, {
      ...element.props,
      children: formatScientificContent(children),
    });
  });
}
