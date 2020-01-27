## Why parsers?

A lot of computation is string processing.  We have excellent tools for processing numbers — every programming language comes with arithmetic calculation — but not such good tools for processing strings.  Sure, we have regular expressions, which are both fast to run and also theoretically sound.  But very few programmers can write a regular expression with the fluency of writing arithmatic expressions, not to mention the difficulty of reading a regular expression written by someone else.

Instead, we end up jerry-rigging our string parsing using `.startsWith` and `.indexOf` methods, cobbling together incomplete parsers that do the bare minimum of what we want.  These tools are brittle and we know it.  And so we shy away from doing string processing unless we know we really need to: user input validation, writing and reading file formats, and string-based identifiers like package names and URIs.

But what if we didn't shy away from string processing?  What if working with strings were as comfortable as working with numbers, or objects with properties?  Perhaps we would write more mini-languages, custom notations for niche applications.  Even just simplifying all existing string processing code would be a big win for programming as a craft.

## Why parser combinators?

There are some excellent tools for parsing already.  A typical computer science education introduces students to [Extended] Backus-Naur Form (EBNF) which can theoretically be input to a parser generator, which, uh, generates a parser.  But EBNF is notoriously tricky to write and nigh-impossible to debug.  More recently, folks interested in parsing have been excited about parsing expression grammars (PEGs).  A PEG for a simple calculator language might look like this:

```
start = additive

additive = multiplicative ([+-] additive)?

multiplicative = primary ([*/] multiplicative)?

primary =   integer /
            parenthetical

parenthetical = "(" additive ")"

integer = [0-9]+
```

Not bad if you want to generate a standalone parser.  But a PEG is not composable.  If you were writing a new programming language with a PEG to generate the parser, you might think to yourself: hey, I should re-use that calculator PEG I saw the other day!  While the thought is good, the only way to actually do that is to copy-paste the calculator PEG and append it to your new language's PEG.  So the author of a PEG parser generator might think that they ought to build a feature for importing PEGs, but then they have to re-implement the well-trodden ground of package management.

This leads to the larger problem, which is that the PEG notation is its own language, separate from the rest of your program.  You don't get all the things you normally get with general-purpose programming languages: interoperability with everything else in the program, package management, variable names, conditionals.  A PEG cannot, for example, have a debug flag that enables or disables a part of a language.

Suppose you wanted to dynamically generate a parser with a PEG based on some user input.  Maybe each user gets to decide whether their language uses brackets or parentheses or some other matching identifiers.  The PEG grammar doesn't have any affordance for taking this sort of user input.  You'd have to have your program generate a PEG by interpolating the user's identifier string into a template for the PEG, and—surprise! We're back in the world of gnarly hacky string processing!

This same problem, by the way, occurs with regular expressions (regexes).  Suppose you write a regex to match against Twitter handles — pretty simple, just check for an at-sign followed by an alphanumeric string:

```
var twitterRegex = /@[a-zA-Z0-9_]+/;
```

Now suppose you want to write a new regex that matches a Twitter handle enclosed by parentheses.  How do you do it?  There are no affordances for combining or composing regular expressions.  We're back to text munging:

```
var parenTwitterRegex = "\(" + twitterRegex.source + "\)";
```

Note that we can see this same problem — the lack of composability — in a different way that crops up in both the PEG and regex examples.  The calculator PEG above included `integer = [0-9]+`.  If you look through PEG examples, you see integers defined this way over and over again.  Why?  Because there's no way to define it once and re-use it elsewhere.  Similarly, there are surely hundreds of thousands of regexes that have been written that include `[a-zA-Z0-9]`.  I know that some regex implementations include predefined character sets for those, but my point is that the regex implementation has to supply those character sets — there's no way for a user of regular expressions to define and reuse a custom character set.

All of this is to say: good string processing tools should be composable, the way arithmetic expressions are composable.  One solution to this is to define the parsing abstractions within the language, like arithmetic expressions, as opposed to as a completely separate embedded language, which are what PEGs and regular expressions do.  Parser combinators are a way to do this, and in the next section I'll show you an idea for parser combinators I've been playing with.

## An experimental parser combinator

Let's start with something simple like parsing a Twitter handle:

```js
with (ParserCombinator) {
    var parseTwitter = seq("@", handle);
}
console.log(parseTwitter("@noahlt");
console.log(parseTwitter("not a twitter handle"));
```

We use the `with` keyword to introduce a scope with all the names from `ParserCombinator`.  That is, inside the `with` block, we can use `seq` and `handle`, both names provided by `ParserCombinator`, without having to invoke them using namespaces like `ParserCombinator.seq` and `ParserCombinator.handle`.

Parser combinators are just functions.  The `seq` function introduces a sequence of other things to parse, which can be strings, regexes, or other parser combinators.  The `handle` function is a shortcut that matches tokens with letters, numbers, underscores and dashes.

Now let's parse version numbers, like `"1.2.3"`:

```js
with (ParserCombinator) {
    var parseSimpleVersion = seq(natnum, ".", natnum, ".", natnum);
}
console.log(parseSimpleVersion("1.2.3"));
```

This one is pretty much the same, except using `natnum`, short for “natural number” — that is, the positive integers.

With the knowledge from parsing Twitter handles and simple version numbers, we can move on to parsing a package specification, like you might provide to a package manager:

```js
with (ParserCombinator) {
    var parsePackageSpec = seq(handle, "@", seq(natnum, ".", natnum, ".", natnum));
}
const spec = parsePackageSpec("foobar@1.2.3");
spec.children[0].raw // "foobar"
spec.children[2].raw // "1.2.3"
spec.children[2].children[0].raw // "1"
```

Accessing these nesting children with indices is clumsy, so instead we can give them names:

```js
with (ParserCombinator) {
    var parsePackageSpec = seq(
        package => handle,
        "@",
        version => seq(major => natnum, ".", minor => natnum, ".", patch => natnum);
    );
}
let spec = parsePackageSpec("foobar@1.2.3");
spec.package.raw // "foobar"
spec.version.raw // "1.2.3"
spec.version.major.raw // "1"
```

This is using a trick where we use Javascript's arrow function notation to give names to each expression.  (Under the hood, `seq` and other ParserCombinator functions actually parse out these source code to these function definitions to get the names.)  As you can see, the names are a lot easier to read than indexing into the `children` arrays.

Finally, the `opt` function specifies an optional parser combinator.  It attempts to parse something with its argument, but if the provided parser combinator fails, `opt` allows the parse to carry on.  We can use it to parse optional notation, like package scopes in NPM package specifications:

```js
const parseNPMSpec = (() => { with (ParserCombinator) {
    return seq(
        scope => opt(seq("@", handle, "/")),
        package => handle,
        "@",
        semver => seq(
            major => natnum, ".",
            minor => natnum, ".",
            patch => natnum,
            prerelease => opt(seq("-", handle))
        ),
    );
}})();

let normalSpec = parseNPMSpec("foo@1.2.3");
let scopedSpec = parseNPMSpec("@foo/bar@1.2.3");
let prereleaseSpec = parseNPMSpec("foo@1.2.4-alpha1");
```

## Future work

I probably won't continue working on this package, as I have been informed that the `with` keyword is not only unavailable in strict mode, but that `webpack` and other modern Javascript tools basically disallow use of that keyword.  This is a pity, because the `with` keyword seems like an incredibly useful tool for defining DSLs — here, there's a block of code that uses parser combinators, which (unlike regexes) is real code, but also uses some unique bindings that are useful within the block and mostly useless outside of it.
