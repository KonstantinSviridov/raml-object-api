import engine = require("./testEngine");
import testUtil = require("raml-1-parser-test-utils");
import path = require("path");

const rootDir = testUtil.rootDir(__dirname);
const typeExpansionDir = path.resolve(rootDir,"test/data/TypeExpansionTests");
const tckDir = path.resolve(rootDir,"test/data/TCK-newFormat");

engine.processDir({
    path: typeExpansionDir,
    expandTypes: true
});

engine.processDir({
    path: tckDir,
    expandTypes: false
});

engine.processDir({
    path: tckDir,
    expandTypes: true,
    skippedErrors: [
        "typePropertyKind",
        "displayName",
        "__METADATA__"
    ]
});
