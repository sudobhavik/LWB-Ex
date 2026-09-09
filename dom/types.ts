export type ElementType =
  | "button"
  | "link"
  | "input";

export type InputType =
  | "text"
  | "email"
  | "password"
  | "search"
  | "tel"
  | "url"
  | "number"
  | "checkbox"
  | "radio"
  | "file"
  | "other";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DOMElement {
  type: ElementType;
  text: string;
  inputType: InputType | null;
  label: string | null;
  placeholder: string | null;
  bbox: BoundingBox;
  selector: string;
}

/*
 * Unified perception result.
 *
 * This allows DOM perception and computer vision
 * to use the same representation.
 */
export interface UnifiedDetection {
  source: "dom" | "vision";

  type: string;

  bbox: BoundingBox;

  confidence?: number;

  protected: boolean;
}