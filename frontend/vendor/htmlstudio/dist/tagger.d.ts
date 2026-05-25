export interface TagOptions {
    taggable?: Set<string>;
    preserveExisting?: boolean;
}
export declare function tagHtml(html: string, options?: TagOptions): string;
/** Strip injected ids — useful for "export clean HTML". */
export declare function untagHtml(html: string): string;
//# sourceMappingURL=tagger.d.ts.map