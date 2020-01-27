function makeSrc(str) {
    if (!str) {
        throw new Error("bad src: "+src);
    } else if (typeof str.orig === 'string' && typeof str.pos === 'number') {
        return str; // it's already a src
    } else if (typeof str !== "string") {
        throw new Error("makeSrc: expected either str or src");
    } else {
        return {
            orig: str,
            rest: str,
            pos: 0,
            first: function(n) {
                return this.rest.slice(0, n);
            },
            match: function(re) {
                return this.rest.match(re);
            },
            advance: function(n) {
                this.pos += n;
                this.rest = this.rest.slice(n);
                return this;
            },
            complete: function() {
                return this.pos === this.orig.length;
            },
        };
    }
}

function makeParser(parseSpec) {
    if (typeof parseSpec === 'function') {
        const parseName = parseFunctionArgName(parseSpec);
        if (parseName && parseName !== "____ParserCombinatorInternalSrc") {
            return ____ParserCombinatorInternalSrc => {
                const r = parseSpec()(____ParserCombinatorInternalSrc);
                r.name = parseName;
                return r;
            };
        } else {
            return parseSpec;
        }
    } else if (typeof parseSpec === 'string') {
        return ParserCombinator.lit(parseSpec);
    } else if (typeof parseSpec === 'regexp') {
        return ParserCombinator.lit(parseSpec);
    } else {
        throw new Error("failed to make parser from: "+ parseSpec);
    }
}


const RE_functionName = /(?:^\(\[([^\]]+)\]\))|([^=\s]+)\s*=>/;
const parseFunctionArgName = f => {
    const m = RE_functionName.exec(f + "");
    return m && m[2];
}
const ParserCombinator = {
    // building blocks
    lit: literal => ____ParserCombinatorInternalSrc => {
        let src = makeSrc(____ParserCombinatorInternalSrc);
        if (src.first(literal.length) === literal) {
            return { raw: literal, remainder: src.advance(literal.length) };
        } else {
            return { src, error: `failed to match literal ${literal} at ${src.pos}`};
        }
    },

    regexp: re => ____ParserCombinatorInternalSrc => {
        let src = makeSrc(____ParserCombinatorInternalSrc);
        const m = src.match(`(${re.source}).*`);
        if (m) {
            return { raw: m[1], remainder: src.advance(m[1].length) };
        } else {
            return { raw: src, error: `failed to match regex ${re} at ${src.pos}`};
        }
    },
    
    // composition
    seq: (...parsers) => ____ParserCombinatorInternalSrc => {
        let src = makeSrc(____ParserCombinatorInternalSrc);
        const origSrc = src;
        const startPos = src.pos;

        const children = [];
        for (let index = 0; index < parsers.length; index++) { // for-loop so we can return early on error
            let res = makeParser(parsers[index])(src);
            if (res.error) {
                return { error: `failed to parse seq #${index}: ${res.error}` };
            } else {
                src = res.remainder;
                // note: we don't ever want to delete res.remainder in order to preserve compositionality!
                if (res.raw) { // TODO: this is a dumb way to signal "we parsed something"
                    children.push(res);
                }
            }
        }
        const parseNode = {
            // use origSrc if src was deleted by a child because parse finished
            raw: src ?
                src.orig.slice(startPos, src.pos) :
                origSrc.orig.slice(startPos),
            remainder: src,
            children,
        };
        for (let child of children) {
            if (child.name) {
                parseNode[child.name] = child;
            }
        }
        return parseNode;
    },

    alt: () => s => undefined,

    opt: (parser) => ____ParserCombinatorInternalSrc => {
        let src = makeSrc(____ParserCombinatorInternalSrc);
        let res = makeParser(parser)(src);
        if (res.error) {
            return {
                remainder: src,
            };
        } else {
            return res;
        }
    },
};

ParserCombinator.natnum = ParserCombinator.regexp(/[0-9]+/);
ParserCombinator.integer = ParserCombinator.regexp(/-?[0-9]+/);

ParserCombinator.word = ParserCombinator.regexp(/[a-zA-Z]+/);
ParserCombinator.identifier = ParserCombinator.regexp(/[a-zA-Z_]+/);
ParserCombinator.handle = ParserCombinator.regexp(/[a-zA-Z_-]+/);

module.exports = { ParserCombinator };
