import raml = require("./model-interfaces");
import index = require("../index");
import ts = index.typesystem;
import ti = ts.tsInterfaces;
import api = require("../typings-new-format/spec-1.0/api");
import datamodel = require("../typings-new-format/spec-1.0/datamodel");
import resources = require("../typings-new-format/spec-1.0/resources");
import methods = require("../typings-new-format/spec-1.0/methods");
import security = require("../typings-new-format/spec-1.0/security");
import common = require("../typings-new-format/spec-1.0/common");
//import typeExpander = require("../util/typeExpander");

export class JsonSerializer{

    serialize(node:raml.IAnnotated):Object{
        return this.serializeApi(<raml.Api>node);
    }

    serializeLibraryBase(node:raml.LibraryBase,result:api.LibraryBase10={}):api.LibraryBase10{
        this.serializeAnnotated(node,<common.Annotable>result);
        const types = node.types();
        if(types&&types.length){
            result.types = types.map(x=>this.serializeTypeDeclaration(x));
        }
        const annotationTypes = node.annotationTypes();
        if(annotationTypes&&annotationTypes.length){
            result.annotationTypes = annotationTypes.map(x=>this.serializeTypeDeclaration(x));
        }
        const securitySchemes = node.securitySchemes();
        if(securitySchemes && securitySchemes.length){
            result.securitySchemes = securitySchemes.map(x=>this.serializeSecuritySchemeDefinition(x));
        }
        return result;
    }

    serializeApi(node:raml.Api, result:api.Api10=<api.Api10>{}):api.Api10{
        result.title = node.title();
        result.protocols = node.protocols();

        this.serializeLibraryBase(node,result);

        if(node.baseUri()!=null){
            result.baseUri = node.baseUri();
        }
        if(node.version()!=null){
            result.version = node.version();
        }
        if(node.description()!=null){
            result.description = node.description();
        }
        const documentation = node.documentation();
        if(documentation && documentation.length){
            result.documentation = documentation.map(x=>this.serializeDocumentation(x));
        }
        const resources = node.resources();
        if(resources && resources.length){
            result.resources = resources.map(x=>this.serializeResource(x));
        }
        this.serializeSecured(node,result);
        const mediaType = node.mediaType();
        if(mediaType && mediaType.length){
            result.mediaType = mediaType;
        }
        const baseUriParameters = node.baseUriParameters();
        if(baseUriParameters && baseUriParameters.length){
            result.baseUriParameters = baseUriParameters.map(x=>this.serializeParameter(x));
        }
        return result;
    }

    serializeSecured(node:{securedBy():raml.SecuredBy[]},result:{securedBy?:security.SecuritySchemeBase10[]}){
        const securedBy = node.securedBy();
        if(securedBy && securedBy.length){
            result.securedBy = securedBy.map(x=>this.serializeSecuritySchemeDefinition(x));
        }
    }

    serializeParameter(x:raml.Parameter):datamodel.TypeDeclaration {
        let t = this.serializeTypeDeclaration(x.type());
        const name = x.name();
        if(!t.name){
            t.name = name;
        }
        else if (t.name != name) {
            t = {
                name: name,
                displayName: name,
                type: [t]
            }
        }
        return t;
    }

    serializeAnnotation(node:raml.IAnnotation):common.AnnotationInstance {
        const result = {
            name: node.name(),
            value: node.value()
        };
        return result;
    }

    serializeAnnotated(node:raml.IAnnotated, result:common.Annotable={}):common.Annotable {
        const annotations = node.annotations();
        if(annotations && annotations.length){
            result.annotations = node.annotations().map(x=>this.serializeAnnotation(x));
        }
        const scalarsAnnotations = node.scalarsAnnotations();
        if(scalarsAnnotations){
            const fNames = Object.keys(scalarsAnnotations);
            if(fNames.length) {
                result.scalarsAnnotations = {};
                for (let fName of fNames) {
                    result.scalarsAnnotations[fName] = scalarsAnnotations[fName].map(x => x.map(y => this.serializeAnnotation(y)));
                }
            }
        }
        return result;
    }

    serializeBody(x:raml.Body):datamodel.TypeDeclaration {
        let t = this.serializeTypeDeclaration(x.type());
        const name = x.mimeType();
        if(!t.name){
            t.name = name;
        }
        else if (t.name != name) {
            t = {
                name: name,
                displayName: name,
                type: [t]
            }
        }
        return t;
    }

    serializeDocumentation(node:raml.Documentation):api.DocumentationItem{
        const result = {
            title: node.title(),
            content: node.content()
        };
        this.serializeAnnotated(node,<common.Annotable>result);
        return result;
    }

    serializeResponse(node:raml.Response):methods.Response10{
        const result:methods.Response10 = {
            code: node.code()
        };
        if(node.description()!=null){
            result.description = node.description();
        }
        this.serializeAnnotated(node,<common.Annotable>result);
        const headers = node.headers();
        if(headers&&headers.length){
            result.headers = headers.map(x=>this.serializeParameter(x));
        }
        let bodies = node.bodies();
        if(bodies && bodies.length){
            result.body = bodies.map(x=>this.serializeBody(x));
        }
        return result;
    }

    serializeMethodBase(node:raml.MethodBase,result:methods.MethodBase10={}):methods.MethodBase10{

        if(node.displayName()){
            result.displayName = node.displayName();
        }
        if(node.description()!=null){
            result.description = node.description();
        }
        if(node.protocols()&&node.protocols().length){
            result.protocols = node.protocols();
        }
        this.serializeAnnotated(node,result);
        const bodies = node.bodies();
        if(bodies&&bodies.length){
            result.body = bodies.map(x=>this.serializeBody(x));
        }
        this.serializeSecured(node,result);
        const parameters = node.parameters();
        if(parameters && parameters.length){
            let queryParameters:raml.Parameter[] = [];
            let headers:raml.Parameter[] = [];
            let queryString:raml.Parameter[] = [];
            let uriParameters:raml.Parameter[] = [];
            for(let p of parameters){
                const location = p.location();
                if(location=="query"){
                    queryParameters.push(p);
                }
                else if(location=="headers"){
                    headers.push(p);
                }
                else if(location=="queryString"){
                    queryString.push(p);
                }
                else if(location=="uriParameters"){
                    uriParameters.push(p);
                }
            }
            if(queryParameters.length){
                result.queryParameters = queryParameters.map(x=>this.serializeParameter(x));
            }
            if(headers.length){
                result.headers = headers.map(x=>this.serializeParameter(x));
            }
            if(queryString.length){
                result.queryString = this.serializeParameter(queryString[0]);
            }
        }
        const responses = node.responses();
        if(responses&&responses.length){
            result.responses = responses.map(x=>this.serializeResponse(x));
        }
        return result;
    }

    serializeMethod(node:raml.Method):methods.Method10{

        const method = node.method();
        const result:methods.Method10 = {
            method: method,
            parentUri: node.resource().fullRelativeUrl(),
            absoluteParentUri: node.resource().absoluteUrl()
        };
        this.serializeMethodBase(node,result);
        const uriParameters = node.parameters().filter(x=>x.location()=="uriParameters");
        if(uriParameters.length){
            result.uriParameters = uriParameters.map(x=>this.serializeParameter(x));
        }
        return result;
    }

    serializeLibrary(node:raml.Library):api.Library{
        let result = <api.Library>this.serializeLibraryBase(node);
        if(node.usage()!=null){
            result.usage = node.usage();
        }
        return result;
    }

    serializeSecuritySchemeDefinition(node:raml.SecuritySchemeDefinition):security.SecuritySchemeBase10{
        return null;
    }

    serializeResourceBase(node:raml.ResourceBase, result:resources.ResourceBase10={}):resources.ResourceBase10{

        if(node.displayName()){
            result.displayName = node.displayName();
        }
        if(node.description()){
            result.description = node.description();
        }
        this.serializeAnnotated(node,result);
        const methods = node.methods();
        if(methods&&methods.length){
            result.methods = methods.map(x=>this.serializeMethod(x));
        }
        this.serializeSecured(node,result);
        const uriParameters = node.allUriParameters();
        if(uriParameters&&uriParameters.length){
            result.uriParameters = uriParameters.map(x=>this.serializeParameter(x));
        }
        return result;
    }

    serializeResource(node:raml.Resource):resources.Resource10{
        const result:resources.Resource10 = {
            relativeUri: node.relativeUrl(),
            completeRelativeUri: node.fullRelativeUrl(),
            absoluteUri: node.absoluteUrl(),
            relativeUriPathSegments: []
        };
        this.serializeResourceBase(node,result);
        const resources = node.resources();
        if(resources && resources.length) {
            result.resources = resources.map(x=>this.serializeResource(x));
        }
        return result;
    }

    serializeTypeDeclaration(node:ti.IParsedType):datamodel.TypeDeclaration{
        return null;//typeExpander.dumpType(node,-1);
    }

}