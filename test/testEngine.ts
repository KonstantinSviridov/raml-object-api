import testUtil = require("raml-1-parser-test-utils");
import path = require("path");
import fs = require("fs");
import parser = require("raml-1-parser");
import index = require("../src/index");

export interface Options {

    path?: string,
    expandTypes?: boolean,
    typeExpansionDepth?: number,
    skippedErrors?: string[]
}


export function processDir(o:Options){
    try {
        o = normalizeOptions(null, o);

        if (fs.lstatSync(o.path).isDirectory()) {
            let fNames = fs.readdirSync(o.path);
            let tckJSONs = fNames.filter(x => x.match(/-tck\.json$/) != null);
            if (tckJSONs.length > 0) {
                for (let fName of tckJSONs) {
                    let chPath = path.resolve(o.path, fName).replace(/\\/g, "/");
                    testJSON(normalizeOptions(chPath, o));
                }
            }
            else {
                for (let fName of fNames) {
                    let chPath = path.resolve(o.path, fName);
                    processDir(normalizeOptions(chPath, o));
                }
            }
        }
        else if (o.path.match(/-tck\.json$/) != null) {
            testJSON(o);
        }
    }
    catch(e){
        console.log(e);
    }
}

let ind = 0;

function compare(expected: any, actual: any, o: Options, filePath: string) {
    let transportDiff = testUtil.compare(expected, actual).filter(x => {
        for (let s of o.skippedErrors.map(x => new RegExp(x))) {
            if (s.test(x.path())) {
                return false;
            }
        }
        if (x.path().indexOf("/mediaType") > 0) {
            return false;
        }
        return true;
    });
    if (transportDiff.length) {
        console.log("" + (ind++) + " Diff for: " + filePath.replace(/\\/g, '/'));
        for (let d of transportDiff) {
            console.log(d.message("expected", "actual"));
        }
    }
}

function testJSON(o:Options){
    const tckJSONPath = o.path;
    for(let st of skippedTests){
        if(tckJSONPath.indexOf(st)>=0){
            return;
        }
    }
    console.log(tckJSONPath.replace(/\\/g,'/'));
    let content = JSON.parse(fs.readFileSync(tckJSONPath,"utf-8"));
    const ramlApiPath = tckJSONPath.replace(/-tck\.json/,'.raml');
    const transportJSON = parser.loadSync(ramlApiPath,{
        expandLibraries: true,
        expandExpressions: true,
        serializeMetadata: true,
        sourceMap: true
    });

    //compare(content, transportJSON, o, tckJSONPath);

    let parserResult = transportJSON;
    let depth = -1;
    if(o.expandTypes) {
        depth = 0;
        parserResult = parser.loadSync(ramlApiPath, {
            expandLibraries: true,
            expandExpressions: true,
            expandTypes: o.expandTypes,
            serializeMetadata: true,
            sourceMap: true
        });
    }

    let json1 = index.expandTypes(transportJSON,{
        serializeMetadata: true,
        typeExpansionRecursionDepth: o.typeExpansionDepth,
        sourceMap: true
    });
    compare(parserResult, json1, o, tckJSONPath);
}

function normalizeOptions(p:string,o:Options):Options{
    let result:Options = JSON.parse(JSON.stringify(o));
    if(p && p.trim()){
        result.path = p;
    }
    if(!result.hasOwnProperty("expandTypes")){
        result.expandTypes = false;
    }
    if(!result.hasOwnProperty("typeExpansionDepth")){
        result.typeExpansionDepth = result.expandTypes ? 0 : -1;
    }
    if(!result.hasOwnProperty("skippedErrors")){
        result.skippedErrors = [];
    }
    return result;
}

const skippedTests = [
    "raml-1.0/Libraries/test007",//array order
    "raml-1.0/Types/test016/apiInvalid",//array order
    "raml-1.0/Types/test017/apiInvalid",//array order

    "raml-1.0/Types/External Types/test010",//extra hierarchy chain
    "raml-1.0/Annotations/test046",//extra hierarchy chain
    "raml-1.0/jsonscheme/test15",//extra hierarchy chain
    "raml-1.0/Types/test037",//extra hierarchy chain
    "raml-1.0/Types/xsdscheme/test012",//extra hierarchy chain

    "raml-1.0/Types/ObjectTypes/test025"
];
