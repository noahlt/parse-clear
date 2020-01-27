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
        return lit(parseSpec);
    } else if (typeof parseSpec === 'regexp') {
        return lit(parseSpec);
    } else {
        throw new Error("failed to make parser from: "+ parseSpec);
    }
}


const RE_functionName = /(?:^\(\[([^\]]+)\]\))|([^=\s]+)\s*=>/;
const parseFunctionArgName = f => {
    const m = RE_functionName.exec(f + "");
    return m && m[2];
}

// building blocks
const lit = (literal) => ____ParserCombinatorInternalSrc => {
    let src = makeSrc(____ParserCombinatorInternalSrc);
    if (src.first(literal.length) === literal) {
        return { str: literal, remainder: src.advance(literal.length) };
    } else {
        return { src, error: `failed to match literal ${literal} at ${src.pos}`};
    }
};

const re = (regex) => ____ParserCombinatorInternalSrc => {
    let src = makeSrc(____ParserCombinatorInternalSrc);
    const m = src.match(`(${regex.source}).*`);
    if (m) {
        return { str: m[1], remainder: src.advance(m[1].length) };
    } else {
        return { str: src, error: `failed to match regex ${regex} at ${src.pos}`};
    }
};
    
// composition
const seq = (...parsers) => ____ParserCombinatorInternalSrc => {
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
            if (res.str) { // TODO: this is a dumb way to signal "we parsed something"
                children.push(res);
            }
        }
    }
    const parseNode = {
        // use origSrc if src was deleted by a child because parse finished
        str: src ?
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
};

const alt = () => s => undefined;

const opt = (parser) => ____ParserCombinatorInternalSrc => {
    let src = makeSrc(____ParserCombinatorInternalSrc);
    let res = makeParser(parser)(src);
    if (res.error) {
        return {
            remainder: src,
        };
    } else {
        return res;
    }
};

const natnum = re(/[0-9]+/);
const integer = re(/-?[0-9]+/);

// not sure about these names:
const word = re(/[a-zA-Z]+/); // alpha
const identifier = re(/[a-zA-Z0-9_]+/); // alphanumeric + underscore
const handle = re(/[a-zA-Z0-9_-]+/); // alphanumeric + underscore + hyphen

const combinators = { lit, re, seq, alt, opt, natnum, integer, word, identifier, handle };

module.exports = Object.assign({}, combinators);

module.exports.ParseClear = function ParseClear(fn) {
    return fn(combinators);
}
