import queryString from "query-string-upstream";

// Router 55 and Navigation 7 use namespace imports; upstream 9 exposes a default.
export const { extract, parse, stringify, parseUrl, stringifyUrl, pick, exclude } = queryString;
export default queryString;
