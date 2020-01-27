// Define a parser for NPM package specifications:

const parseNPMSpec = (() => { with (ParserCombinator) {
    return seq(
        scope => opt(seq("@", handle, "/")),
        packageName => handle,
        "@",
        semver => seq(major => natnum, ".", minor => natnum, ".", patch => natnum),
        prerelease => opt(seq("-", handle))
    );
}})();

// Use it:

const simple = parseNPMSpec("foo@1.0.0");

console.log("packageName: " + simple.packageName.raw);
// packageName: foo
console.log("semver: " + simple.semver.raw);
// semver: 1.0.0
console.log("major version: " + simple.semver.major.raw);
// major version: 1

console.log('-------');

const full = parseNPMSpec("@foo/bar@1.0.0-alpha2");
console.log("scope: " + full.scope.raw);
console.log("prerelease: " + full.prerelease.raw);