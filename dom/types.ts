//the type definitions for the DOM elements and their properties, including element types, input types, bounding boxes, and the structure of a DOM element. These types are used in the Perception module to represent the elements found during the analysis of the DOM and visible text on a webpage.

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
// this interface represents a DOM element with its type, text content, input type (if applicable), associated label and placeholder text, bounding box coordinates, and a unique selector for identifying the element within the DOM.
export interface DOMElement {
  type: ElementType;

  text: string;

  inputType: InputType | null;

  label: string | null;

  placeholder: string | null;

  bbox: BoundingBox;

  selector: string;
}