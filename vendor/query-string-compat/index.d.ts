import queryString from "query-string-upstream";

export declare const extract: typeof queryString.extract;
export declare const parse: typeof queryString.parse;
export declare const stringify: typeof queryString.stringify;
export declare const parseUrl: typeof queryString.parseUrl;
export declare const stringifyUrl: typeof queryString.stringifyUrl;
export declare const pick: typeof queryString.pick;
export declare const exclude: typeof queryString.exclude;
export default queryString;
export type {
  ParseOptions, ParsedQuery, ParsedUrl, StringifyOptions,
  Stringifiable, StringifiableRecord, UrlObject
} from "query-string-upstream";
