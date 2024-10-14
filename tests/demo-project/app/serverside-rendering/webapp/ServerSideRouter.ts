import Router, { Router$RouteMatchedEventParameters } from "sap/ui/core/routing/Router";
import ServerSideRoute from "./ServerSideRoute";

/**
 * @namespace be.wl.serversiderendering
 */
export default class ServerSideRouter extends Router {
    /**
     * fireRouteMatched
     */
    fireRouteMatched(parameters?: Router$RouteMatchedEventParameters) {
        super.fireRouteMatched(parameters);
        return this;
    }
    _createRoute(router:ServerSideRouter, config:any, parent:any){
        return new ServerSideRoute(router, config, parent,this._oOwner);
    }
}

	// 		fireRouteMatched : function (mArguments) {
	// 			var oRoute = this.getRoute(mArguments.name),
	// 				oTargetConfig;

	// 			// only if a route has a private target and does not use the targets instance of the router we need to inform the targethandler
	// 			if (oRoute._oTarget) {
	// 				oTargetConfig = oRoute._oTarget._oOptions;

	// 				this._oTargetHandler.addNavigation({
	// 					navigationIdentifier : mArguments.name,
	// 					transition: oTargetConfig.transition,
	// 					transitionParameters: oTargetConfig.transitionParameters,
	// 					eventData: mArguments.arguments,
	// 					targetControl: mArguments.targetControl,
	// 					aggregationName: oTargetConfig.controlAggregation,
	// 					view: mArguments.view,
	// 					preservePageInSplitContainer: oTargetConfig.preservePageInSplitContainer
	// 				});
	// 			}

	// 			return Router.prototype.fireRouteMatched.apply(this, arguments);
	// 		},

	// 		fireRoutePatternMatched : function (mArguments) {
	// 			var sRouteName = mArguments.name,
	// 				oRoute = this.getRoute(sRouteName),
	// 				iLevel;

	// 			// only if a route has a private target and does not use the targets instance of the router we need to inform the targethandler
	// 			if (oRoute._oTarget) {
	// 				if (this._oTargets && this._oTargets._oLastDisplayedTarget) {
	// 					iLevel = this._oTargets._getLevel(this._oTargets._oLastDisplayedTarget);
	// 				}

	// 				this._oTargetHandler.navigate({
	// 					navigationIdentifier: sRouteName,
	// 					level: iLevel,
	// 					askHistory: true
	// 				});
	// 			}

	// 			return Router.prototype.fireRoutePatternMatched.apply(this, arguments);
	// 		}

	// 	});

	// 	return MobileRouter;

	// });
