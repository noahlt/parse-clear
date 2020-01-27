const { ParseClear } = require("./main.js");

// Define a parser for NPM package specifications:

const parseNPMSpec = ParseClear(({seq, opt, handle, natnum}) =>
    seq(
        scope => opt(seq("@", handle, "/")),
        packageName => handle,
        "@",
        semver => seq(
            major => natnum, ".",
            minor => natnum, ".",
            patch => natnum,
            prerelease => opt(seq("-", handle)),
        ),
    )
);

// Use it:

const simple = parseNPMSpec("foo@1.0.0");

console.log('Simple example:');
console.log("packageName: " + simple.packageName.str);
// packageName: foo
console.log("semver: " + simple.semver.str);
// semver: 1.0.0
console.log("major version: " + simple.semver.major.str);
// major version: 1

console.log('\nFull example:');

const full = parseNPMSpec("@foo/bar@1.0.0-alpha2");
console.log("scope: " + full.scope.str);
console.log("prerelease: " + full.semver.prerelease.str);
