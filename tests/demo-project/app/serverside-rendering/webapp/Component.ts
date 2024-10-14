import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";

/**
 * @namespace be.wl.serversiderendering
 */
export default class Component extends BaseComponent {

    public static metadata = {
        manifest: "json"
    };

    // constructor(id:string, settings:any) {
    //     super(id,setings);

    // }

    /**
     * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
     * @public
     * @override
     */
    public init(): void {
        // call the base component's init function
        super.init();

        // enable routing
        // const routingManifestEntry = this.getManifestEntry("/sap.ui5/routing") || {},
        //     routingConfig = routingManifestEntry.config || {},
        //     routes = routingManifestEntry.routes;

        //     routingConfig.async = true;


        // // if a classname is configured, the Router class MUST be loaded
        // this._oRouter = new fnRouterConstructor(routes, oRoutingConfig, this, routingManifestEntry.targets, this._oRouterHashChanger);
        this.getRouter().initialize();

        // set the device model
        this.setModel(createDeviceModel(), "device");
    }
}