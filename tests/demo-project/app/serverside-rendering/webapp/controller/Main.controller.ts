import HBox from "sap/m/HBox";
import { ListBase$SelectionChangeEvent } from "sap/m/ListBase";
import Page from "sap/m/Page";
import Event from "sap/ui/base/Event";
import Control from "sap/ui/core/Control";
import Fragment from "sap/ui/core/Fragment";
import ListItem from "sap/ui/core/ListItem";
import UIComponent from "sap/ui/core/UIComponent";
import Controller from "sap/ui/core/mvc/Controller";
import { Route$PatternMatchedEvent } from "sap/ui/core/routing/Route";
import Router, { Router$RoutePatternMatchedEvent } from "sap/ui/core/routing/Router";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import { List$SelectionChangeEvent } from "sap/ui/webc/main/List";

/**
 * @namespace be.wl.serversiderendering.controller
 */
export default class Main extends Controller {

    /*eslint-disable @typescript-eslint/no-empty-function*/
    public onInit() {
    }
    public onSelectedBook(event:ListBase$SelectionChangeEvent){
        const bookID = event.getParameter("listItem")?.getCustomData().find(customData => customData.getKey() === "ID")?.getValue();
        this.getRouter().navTo("detail", { "id": bookID });
    }
    public getRouter() : Router {
		return UIComponent.getRouterFor(this);
	}
}