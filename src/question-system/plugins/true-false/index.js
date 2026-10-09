import core from "./core";
import { register } from "../registry";
import Editor from "./Editor";
import Preview from "./Preview";
import Renderer from "./Renderer";

register({ type: core.type, Editor, Preview, Renderer });

export { default as core } from "./core";
export { default as Editor } from "./Editor";
export { default as Preview } from "./Preview";
export { default as Renderer } from "./Renderer";
