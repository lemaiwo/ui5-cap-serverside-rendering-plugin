
const globalcds = global.cds || require("@sap/cds");
const Handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const { Readable } = require('stream');


globalcds.once("served", async () => {
    if (!("ServerSideRendering" in cds.model.definitions)) return;

    for (let srv of globalcds.services) {
        if (srv instanceof cds.ApplicationService) {
            Object.values(srv.entities).forEach((entity) => {
                if (entity["@ServerSideRendering"]) {
                    srv.after("READ", entity.name, getUI);
                }
            });
        }
    }
});
function isObjectEmpty(objectName) {
    for (let prop in objectName) {
        if (objectName.hasOwnProperty(prop)) {
            return false;
        }
    }
    return true;
};
async function getUI([results], req) {
    if (!req?.req?.url?.endsWith("/content")) return;

    const validTypes = new Set(["view", "fragment"]);
    const isKeyEmpty = isObjectEmpty(results);
    const pathEntity = req.query.SELECT.from.ref[0].id;
    const entity = pathEntity.substring(pathEntity.indexOf(".") + 1);
    const entityDefinition = req.query.SELECT.from.$refLinks[0].definition;

    const expand = (rootEntity)=>{
        let expand = [];
        for(const relationship of ["associations","compositions"]){
            for(const rel in entityDefinition[relationship]){
                expand.push(rootEntity[rel](c => {
                    c`.*`
                }))
            }
        }
        return expand;
    }

    let fragment = `${entity}${isKeyEmpty ? "List" : "Detail"}`;
    let query = isKeyEmpty ? SELECT.from({ ref: [{ id: pathEntity }] }) : SELECT.from(req.query.SELECT.from).columns(b => {
        b`.*`, expand(b)
    });

    // let query = isKeyEmpty ? SELECT.from({ ref: [{ id: pathEntity }] }) : SELECT.from(req.query.SELECT.from).columns(b => {
    //     b`.*`, b.to_author(c => {
    //         c`.*`
    //     })
    // });
    const queryResult = await query;

    let templateData = {};
    isKeyEmpty ? (templateData[entity] = queryResult) : ([templateData] = queryResult);

    let type = req.query.SELECT.from.$refLinks[0].definition["@ServerSideRenderingType"] || "view";
    !validTypes.has(type) && (type = "view");

    const filedata = fs.readFileSync(path.join(globalcds.root, `./srv/${type}s`, `${fragment}.${type}.xml`));
    const template = Handlebars.compile(filedata.toString());
    const result = template(templateData);
    const readableInstanceStream = new Readable({
        read() {
            this.push(result);
            this.push(null);
        }
    });
    req._.res.setHeader('Content-disposition', `attachment; ${fragment}.fragment.xml`);
    req._.res.setHeader('Content-type', 'application/xml');

    if (results) {
        results.content = readableInstanceStream;
    } else {
        req.results = { ID: 0, content: readableInstanceStream };
    }
}