/*
Helper functions for the application
-- datacalls defined
-- Array move 
*/
sap.ui.define([
		"sap/m/MessageBox",
		"sap/ui/model/odata/ODataModel",
		"brs_demo_tablemaster/FilterPane/FilterUtils"
	],
	function (MessageBox, ODataModel, FilterUtils) {
		return {
			initUtilities: function (oController) {
				this.oController = oController;
			},

			checkSpecialRangeFilter: function (variantData) {
				/*this will only check if a special range filter is set with a default value*/
				//replace with filter for IE and edge
				var specialRangeFilterSet = false;
				// var field;
				var filterValList = variantData.FilterPanel;
				if (filterValList && filterValList.Fields && filterValList.Fields.length && filterValList.Fields.length > 0) {
					filterValList.Fields.filter(function (fieldData) {
						if (fieldData.SelectionControl && fieldData.SelectionControl.toLowerCase() === "specialrange") {
							if (fieldData.DefaultFilterVal && fieldData.DefaultFilterVal.length && fieldData.DefaultFilterVal.length > 0) {
								specialRangeFilterSet = true;
							}
						}
					}, this);
				}

				return specialRangeFilterSet;

			},

			mergeJTFPVarfilters: function (variantData) {
				/*Merge Filters for FilterPane and Variantconfig when data on Filter Pane UI is not reliable
					- called Initially when data is fetched.
					- overrides the Jump To filters
					*/
				var fpFieldnames = [],
					jumpToFilters;
				var vFields = variantData.Fields;
				var fpFields = variantData.FilterPanel.Fields;
				fpFields.forEach(function (fpField) {
					fpFieldnames.push(fpField.Fieldname);
				}, this);

				if (this.oController.jumpTo) {
					jumpToFilters = this.oController.jumpToData;
				}

				vFields.forEach(function (vField, idx) {
					/*loop throught the variant Fields to Override the appropriate Filters
					PRIORITY:
					 - JumpTo Filters
					 - Variant Filters
					 - Filter Pane Filters
					*/
					var vFieldFilters;
					if (jumpToFilters) {
						var jtFilter = jumpToFilters.filter(function (jumpToFilter) {
							return jumpToFilter.Fieldname === vField.Fieldname;
						}, this);
					}

					if (jtFilter && jtFilter.length && jtFilter.length > 0) {
						vFieldFilters = [];
						jtFilter.forEach(function (jtObj) {
							if (jtObj.hasOwnProperty("val_low") && jtObj.val_low.toLowerCase() !== "all") {
								vFieldFilters.push(jtObj);
								variantData.Fields[idx]["Filter_Val"] = vFieldFilters;
							}
						}, this);
					} else if ((!vField.Filter_Val || (vField.Filter_Val instanceof Array && vField.Filter_Val.length <= 0)) && fpFieldnames.indexOf(
							vField.Fieldname) > -1) {
						// Field is a Filter Panel Field
						var idxFP = fpFieldnames.indexOf(vField.Fieldname);
						var controlType = fpFields[idxFP].SelectionControl;
						if (controlType && controlType.toLowerCase() === "specialrange") {
							var fpFilter = fpFields[idxFP].DefaultFilterVal;
							if (fpFilter && fpFilter[0].val_low !== "Custom") {
								this.getPeriods(fpFilter[0].val_low, $.proxy(function (oData) {
										var res = oData.results[0];
										if (res.ToPeriod) {
											//between period
											vFieldFilters = [{
												Fieldname: vField.Fieldname,
												filter_op: "bt",
												val_low: res.FromPeriod,
												val_high: res.ToPeriod
											}];
										} else {
											//single period
											vFieldFilters = [{
												Fieldname: vField.Fieldname,
												filter_op: "eq",
												val_low: res.FromPeriod
											}];
										}
										variantData.Fields[idx].Filter_Val = vFieldFilters;
									}, this),
									$.proxy(function (oErr) {
										jQuery.sap.log.error("cannot Fetch Periods");
									}, this));
							}
						}

					}
					/*special case to cater for Lease Commitments reports*/
					else if (vField.Fieldname.toLowerCase() === "periodid" && variantData && variantData.AppVariantType && (variantData.AppVariantType
							.toLowerCase() === "sptable_lcomm_month" ||
							variantData.AppVariantType.toLowerCase() === "sptable_lcomm_year")) {
						//Add 2 or 5 years to the current PeriodID.
						var highPeriod;
						var pURL = this.oController.serviceURL +
							"/BRS/Architect_DataModel/Query/FTM/services/CUR_PERIODS.xsodata/CUR_PERIODS?$format=json&$filter=Type eq 'CurrentCalMonth'";
						$.ajax({
							url: pURL,
							type: "GET",
							async: false,
							context: this,
							contentType: "application/json",
							Accept: "application/json",
							success: function (pData) {
								var currFromPeriod = pData.d.results[0].FromPeriod;
								var currYear = (currFromPeriod) ? currFromPeriod.substr(0, 4) : null;
								var currMonth = (currFromPeriod) ? currFromPeriod.substr(4, currFromPeriod.length - 1) : null;

								if (currYear && variantData.AppVariantType === "sptable_lcomm_month") {
									//Add 2 years.
									highPeriod = (parseInt(currYear, 10) + 2) + "" + currMonth;
								} else if (currYear && variantData.AppVariantType === "sptable_lcomm_year") {
									//Add 5 years.
									highPeriod = (parseInt(currYear, 10) + 5) + "" + currMonth;
								} else {
									highPeriod = currFromPeriod;
								}

								variantData.Fields[idx].Filter_Val = [{
									Fieldname: vField.Fieldname,
									filter_op: "bt",
									val_low: currFromPeriod,
									val_high: highPeriod
								}];

							},
							error: function () {
								jQuery.sap.log.error(
									"!!!!!!!!!!!!!!!!!!Lease Commitment report period will fail. No Period value!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
							}
						});
					} else {
						/*Don't do anything*/
					}
				}, this);

				/*Special filters for work order management. Only valid for WorkOrderStatus and WorkOrderDueDate*/
				if (fpFieldnames.indexOf("WorkOrderStatus") > -1) {
					var vWoStatusField = vFields.filter(function (field) {
						return field.Fieldname === "WorkOrderStatus";
					}, this);
					var vWoDueDateField = vFields.filter(function (field) {
						return field.Fieldname === "WorkOrderDueDate";
					}, this);
					var idxFP = fpFieldnames.indexOf("WorkOrderStatus");
					var fpFilter = fpFields[idxFP].DefaultFilterVal;
					var defaultStatusKey = ["INPL", "PLND", "SCHD", "DISP", "ACKN", "REJT", "ONST", "MSAF", "HOLD", "INPR"];
					var statusArr = [];
					var dueDate;
					switch (fpFilter) {
					case "OpenA":
						if (vWoStatusField) {
							defaultStatusKey.forEach(function (key) {
								statusArr.push({
									Fieldname: vWoStatusField.Fieldname,
									operator: "eq",
									val_low: key
								});
							}, this);
						}
						break;
					case "OverdueA":
						if (vWoStatusField) {
							defaultStatusKey.forEach(function (key) {
								statusArr.push({
									Fieldname: vWoStatusField.Fieldname,
									operator: "eq",
									val_low: key
								});
							}, this);
						}

						if (vWoDueDateField) {
							dueDate = [{
								Fieldname: vWoDueDateField.Fieldname,
								operator: "le",
								val_low: new Date()
							}];
						}
						break;
					case "Duenext24":
						if (vWoStatusField) {
							defaultStatusKey.forEach(function (key) {
								statusArr.push({
									Fieldname: vWoStatusField.Fieldname,
									operator: "eq",
									val_low: key
								});
							}, this);
						}

						if (vWoDueDateField) {
							dueDate = [{
								Fieldname: vWoDueDateField.Fieldname,
								operator: "le",
								val_low: new Date(new Date().setDate(new Date().getDate() + 1))
							}];
						}
						break;
					}
				}

				// variantData.IsSuper = null;
				variantData.UsrVariantID = "$DEFAULT";
				variantData.Username = "";
				if (variantData.IsSuper) {
					delete variantData.IsSuper;
				}
				variantData.UsrVariantDescription = variantData.Description;
				if (!(variantData.Description.startsWith("$"))) {
					variantData.UsrVariantDescription = "$DEFAULT " + variantData.Description;
				}
				this.oController.saveVariantConfig(variantData, false);
			},

			getPeriods: function (pFilter, successCallback, errCallback) {
				var url = this.oController.serviceURL +
					"/BRS/Architect_DataModel/Query/FTM/services/CUR_PERIODS.xsodata";
				var entity = "/CUR_PERIODS";

				var pModel = new ODataModel(url, {
					json: true
				});

				pModel.read(entity, {
					async: false,
					filters: [new sap.ui.model.Filter({
						path: "Type",
						operator: "EQ",
						value1: pFilter
					})],
					success: successCallback,
					error: errCallback
				});
			},

			/*Utility function to fetch the jumpTo information from the left hand side filter Panel*/
			saveJumptoInfo: function (controller, successCallBack, errCallBack, dataFilter, excludeFieldList) {
				var url = controller.serviceURL + "/BRS/HAA/services/SessionParameters.xsodata";
				var sPath = "/SessionParameters";

				function guid() {
					function s4() {
						return Math.floor((1 + Math.random()) * 0x10000)
							.toString(4)
							.substring(1);
					}
					return s4() + s4();
				}
				var jtID = guid();
				var fltrData = this.getFilterPaneData(controller);
				if (dataFilter && dataFilter.length && dataFilter.length > 0) {
					fltrData = fltrData.concat(dataFilter);
				}

				if (excludeFieldList) {
					/*check for excluded Filters*/
					fltrData = fltrData.filter(function (fltrItm) {
						return (excludeFieldList.indexOf(fltrItm.Fieldname) === -1);
					}, this);
				}

				var mOData = new ODataModel(url, {
					json: true
				});

				mOData.create(sPath, {
					Paramname: "jumpTo",
					Value: JSON.stringify({
						"key": jtID,
						"value": fltrData
					})
				}, {
					async: false,
					success: successCallBack(jtID),
					error: errCallBack
				});
			},

			getFilterPaneData: function (controller, groupedData) {
				var form = controller.getView().byId("idBRSFilterPaneForm");
				if (form && form.getContent()) {
					var contentArr = form.getContent();
					var newFilter = [];
					var oFilterDataGrouped = [];
					contentArr.forEach(function (content) {
						var newFilterFP = [];
						var controlType = content.data("selectionControl");
						switch (controlType && controlType.toLowerCase()) {
						case "single":
						case "multi":
							newFilterFP = FilterUtils.singleMultiFilters(content, controlType);
							if (newFilterFP.length > 0) {
								newFilter = newFilter.concat(newFilterFP);
								oFilterDataGrouped.push({
									filter: newFilterFP,
									dataType: controlType.toLowerCase()
								});
							}
							break;
						case "range":
							newFilterFP = FilterUtils.rangeFilters(content);
							if (newFilterFP.length > 0) {
								newFilter = newFilter.concat(newFilterFP);
								oFilterDataGrouped.push({
									filter: newFilterFP,
									dataType: controlType.toLowerCase()
								});
							}
							break;
						case "rangenumber":
							newFilterFP = FilterUtils.numberRangeFilters(content);
							if (newFilterFP.length > 0) {
								newFilter = newFilter.concat(newFilterFP);
								oFilterDataGrouped.push({
									filter: newFilterFP,
									dataType: controlType.toLowerCase()
								});
							}
							break;
						case "rangedate":
							newFilterFP = FilterUtils.rangeDateFilters(content);
							if (newFilterFP.length > 0) {
								newFilter = newFilter.concat(newFilterFP);
								oFilterDataGrouped.push({
									filter: newFilterFP,
									dataType: controlType.toLowerCase()
								});
							}
							break;
						case "specialrange":
							newFilterFP = FilterUtils.specialRangeFilters(content);
							if (newFilterFP.length > 0) {
								newFilter = newFilter.concat(newFilterFP);
								oFilterDataGrouped.push({
									filter: newFilterFP,
									dataType: controlType.toLowerCase()
								});
							}
							break;
						case "specialwostatus":
							newFilterFP = FilterUtils.specialWOStatusFilters(content);
							if (newFilterFP.length > 0) {
								newFilter = newFilter.concat(newFilterFP);
								oFilterDataGrouped.push({
									filter: newFilterFP,
									dataType: controlType.toLowerCase()
								});
							}
							break;
						case "specialassetdaterange":
							newFilterFP = FilterUtils.specialAssetDateFilters(content);
							if (newFilterFP.length > 0) {
								newFilter = newFilter.concat(newFilterFP);
								oFilterDataGrouped.push({
									filter: newFilterFP,
									dataType: controlType.toLowerCase()
								});
							}
							break;
						default:
						}
					}, this);

					if (groupedData && groupedData === true) {
						return oFilterDataGrouped;
					} else {
						return newFilter;
					}
				}
			},

			_prepareFilters: function (filterArr, controller) {
				var orFilterArr = [];
				var finalFilter;

				filterArr.forEach(function (oIntmArr) {
					var oIntermediateFilterArr = oIntmArr.filter;
					var tempFilterArr = [];
					oIntermediateFilterArr.forEach(function (oFilterObj) {
						if (oFilterObj && oFilterObj.val_high) {
							tempFilterArr.push(new sap.ui.model.Filter({
								path: oFilterObj.Fieldname,
								operator: oFilterObj.filter_op.toUpperCase(),
								value1: oFilterObj.val_low,
								value2: oFilterObj.val_high
							}));
						} else {
							tempFilterArr.push(new sap.ui.model.Filter({
								path: oFilterObj.Fieldname,
								operator: oFilterObj.filter_op.toUpperCase(),
								value1: oFilterObj.val_low,
							}));
						}
					}, this);

					//create OR filters
					if (tempFilterArr && tempFilterArr.length > 0) {
						orFilterArr.push(new sap.ui.model.Filter({
							filters: tempFilterArr,
							and: false
						}));
					}
				}, this);

				//Create the and array and return the final filter
				if (orFilterArr && orFilterArr.length > 0) {
					finalFilter = new sap.ui.model.Filter({
						filters: orFilterArr,
						and: true
					});
				}
				return finalFilter;
			},

			_prepareFiltersAsString: function (filterArr, controller) {
				// var orFilterArr = [];
				var finalFilterString;
				var andFilterStr = "";
				filterArr.forEach(function (oIntmArr) {
					var orFilterStr = "";
					var dataType = oIntmArr.dataType;
					var oIntermediateFilterArr = oIntmArr.filter;
					oIntermediateFilterArr.forEach(function (oFilterObj) {

						//each oFilterObj is an or string

						// orFilterStr += oFilterObj.Fieldname + " " + oFilterObj.filter_op.toLowerCase() + " '" + oFilterObj.val_low + "' or ";
						if (oFilterObj && oFilterObj.val_high) {
							//Check if the value is a date
							// var date = new Date(oFilterObj.val_low);
							if (dataType === "date" || dataType === "datetime" || dataType === "time" || dataType === "rangedate") {
								orFilterStr += oFilterObj.Fieldname + " ge datetime'" + oFilterObj.val_low + "T00:00:00' and " + oFilterObj.Fieldname +
									" le datetime'" + oFilterObj.val_high + "T00:00:00' or ";
							} else {
								orFilterStr += oFilterObj.Fieldname + " ge " + oFilterObj.val_low + " and " + oFilterObj.Fieldname + " le '" +
									oFilterObj.val_high + "' or ";
							}
						} else {
							var date = new Date(oFilterObj.val_low);
							if (dataType === "date" || dataType === "datetime" || dataType === "time") {
								orFilterStr += oFilterObj.Fieldname + " " + oFilterObj.filter_op.toLowerCase() + " datetime'" + oFilterObj.val_low +
									"T00:00:00' or ";
							} else {
								orFilterStr += oFilterObj.Fieldname + " " + oFilterObj.filter_op.toLowerCase() + " '" + oFilterObj.val_low + "' or ";
							}

						}
					}, this);

					//remove the last or
					var lastIdxofOR = orFilterStr.lastIndexOf(" or ");
					if (orFilterStr && orFilterStr.length && orFilterStr.length > 0 && lastIdxofOR > -1) {
						orFilterStr = "(" + orFilterStr.substring(0, lastIdxofOR) + ")";
					}

					//Create the and Filter
					andFilterStr += orFilterStr + " and ";
				}, this);

				//remove the last and return the final filter
				var lastIdxofAND = andFilterStr.lastIndexOf(" and ");
				if (andFilterStr && andFilterStr.length > 0 && lastIdxofAND > -1) {
					finalFilterString = "(" + andFilterStr.substring(0, lastIdxofAND) + ")";
				}
				return finalFilterString;
			},

			addCustomStyleClass: function (control, styleClass) {
				control.addStyleClass(styleClass);
			},

			sortVariantList: function (variantData) {
				variantData.sort(function (a, b) {
					var aType = a.AppVariantID,
						bType = b.AppVariantID;
					if (a.Type === "User") {
						aType = a.UsrVariantID;
					}

					if (b.Type === "User") {
						bType = b.UsrVariantID;
					}
					if (a.UsrVariantID === "$DEFAULT") {
						return 1;
					} else if (b.UsrVariantID === "$DEFAULT") {
						return -1;
					}
					if (aType < bType) {
						return -1;
					} else if (aType > bType) {
						return 1;
					} else {
						return 0;
					}
				});
			},

			/*Function to color code special forecast table **sptable_period***/
			spTableFormatter: function (cellVal, delimiter) {
				var obj;
				if (String(cellVal).indexOf(delimiter) > -1) {
					obj = {
						"colorCode": cellVal.split(delimiter)[0],
						"value": cellVal.split(delimiter)[1],
						"value2": ""
					};
					if (cellVal.split(delimiter)[2]) {
						obj.value2 = cellVal.split(delimiter)[2];
					}
				}
				return obj;
			},

			/*Get ID from variant service for the particular description while jumpting to Target App*/
			getIdforDescription: function (callBack, controller, vData, fName, fValue) {
				var paramStr,
					callPath = vData.ServEntity;
				var fNameArr, mappedId;
				if (vData && vData.Fields && vData.Fields.length) {
					fNameArr = vData.Fields.filter(function (field) {
						return field.Fieldname === fName;
					}, this);
				}
				if (fNameArr && fNameArr.length && fNameArr.length > 0 && fNameArr[0].IdMappingParam) {
					mappedId = fNameArr[0].IdMappingParam;
				}

				if (mappedId) {
					/*Check for Parameters list and values in the paramter. can be only one value for parameter*/
					var paramsArr = vData.Fields.filter(function (field) {
						if (field.hasOwnProperty("IsParameter") && field.IsParameter === "true") {
							return field;
						}
					}, this);

					for (var i = 0; i < paramsArr.length; i++) {
						var paramObj = paramsArr[i];
						if (paramObj.Filter_Val && paramObj.Filter_Val.length) {
							if (paramObj.Filter_Val.length === 0 || paramObj.Filter_Val >= 2) {
								sap.ui.core.BusyIndicator.hide();
								MessageBox.alert(this.controller.oBundle.getProperty("navNotPossible"));
								return;
							} else {
								if (paramStr) {
									paramStr += paramObj.Fieldname + "='" + paramObj.Filter_Val[0].val_low + "', ";
								} else {
									//First time
									paramStr = "(" + paramObj.Fieldname + "='" + paramObj.Filter_Val[0].val_low + "', ";
								}
							}
						} else {
							//Hardcoded
							sap.ui.core.BusyIndicator.hide();
							MessageBox.alert(this.controller.oBundle.getProperty("fltrErr2"));
							return;
						}
					}

					/*Remove the last comma and close the braces*/
					paramStr = (paramStr !== undefined) ? paramStr.replace(/,\s*$/, "") + ")" : undefined;
					var service = vData.Service.startsWith("/") ? controller.serviceURL + vData.Service :
						controller.serviceURL + "/" + vData.Service;
					var idModel = new ODataModel(service, {
						json: true
					});
					if (paramStr) {
						callPath = callPath + "Parameters" + paramStr + "/Results";
					}
					var filter = new sap.ui.model.Filter(fName, sap.ui.model.FilterOperator.EQ, fValue);
					idModel.read("/" + callPath, {
						async: false,
						urlParameters: {
							$select: mappedId
						},
						filters: [filter],
						success: function (oData) {
							callBack(oData, mappedId);
						},
						error: function (oErr) {
							callBack(false);
						}
					});
				} else {
					//Don't have a mapping param, this filter will be discarded.
					callBack("noMappedId");
				}
			},

			formatValue: function (cellVal, fieldType, formatStyle, fracDigits) {
				var fInstance,
					value = cellVal;
				if (!fieldType || !cellVal) {
					return value;
				}
				switch (fieldType && fieldType.toLowerCase()) {
				case "curr":
					fInstance = sap.ui.core.format.NumberFormat.getCurrencyInstance({
						style: (formatStyle) ? formatStyle.toLowerCase() : "standard",
						minFractionDigits: 2,
						maxFractionDigits: (fracDigits && !isNaN(parseInt(fracDigits, 10))) ? parseInt(fracDigits, 10) : 2
					});
					value = (cellVal && !isNaN(parseFloat(cellVal))) ? fInstance.format(cellVal, "$") : null;
					break;
				case "percent":
					fInstance = sap.ui.core.format.NumberFormat.getPercentInstance({
						style: (formatStyle) ? formatStyle.toLowerCase() : "standard",
						minFractionDigits: 0,
						maxFractionDigits: (fracDigits && !isNaN(parseInt(fracDigits, 10))) ? parseInt(fracDigits, 10) : 2
					});
					value = (cellVal && !isNaN(parseFloat(cellVal))) ? fInstance.format(cellVal / 100) : null;
					break;
				case "int":
					fInstance = sap.ui.core.format.NumberFormat.getIntegerInstance({
						style: (formatStyle) ? formatStyle.toLowerCase() : "standard"
					});
					value = (cellVal && !isNaN(parseFloat(cellVal))) ? fInstance.format(cellVal) : null;
					break;
				case "dec":
					fInstance = sap.ui.core.format.NumberFormat.getFloatInstance({
						style: (formatStyle) ? formatStyle.toLowerCase() : "standard",
						minFractionDigits: (fracDigits && !isNaN(parseInt(fracDigits, 10))) ? parseInt(fracDigits, 10) : 0,
						maxFractionDigits: (fracDigits && !isNaN(parseInt(fracDigits, 10))) ? parseInt(fracDigits, 10) : 2
					});
					value = (cellVal && !isNaN(fInstance.parse(cellVal))) ? fInstance.format(cellVal) : null;
					break;
				case "date":
					if (cellVal) {
						var dVal = new Date(cellVal);
					}
					var neg = false;
					if (sap.ui.Device.browser.msie) {
						if (dVal && dVal.getTime() && dVal.getTime() < 0) {
							neg = true;
						}
					} else {
						if (Math.sign(dVal) < 0) {
							neg = true;
						}
					}

					if (neg) {
						value = null;
					} else {
						fInstance = sap.ui.core.format.DateFormat.getDateInstance({
							strictParsing: true
						});
						value = dVal ? fInstance.format(dVal) : null;
					}
					break;
				case "time":
					if (cellVal) {
						var tVal;
						if (cellVal.__edmType) {
							cellVal = cellVal.ms;
						}
						var now = new Date();
						cellVal = new Date(cellVal);
						tVal = new Date(now.getUTCFullYear(), now.getMonth(), now.getUTCDate(), cellVal.getUTCHours(), cellVal.getUTCMinutes(), cellVal.getUTCSeconds());
						tVal = new Date(tVal.getTime());
					}
					fInstance = sap.ui.core.format.DateFormat.getTimeInstance({
						strictParsing: true
					});
					value = tVal ? fInstance.format(tVal) : null;
					break;
				case "datetime":
					if (cellVal) {
						var dtVal = new Date(cellVal);
					}
					fInstance = sap.ui.core.format.DateFormat.getDateTimeInstance({
						strictParsing: true
					});
					value = dtVal ? fInstance.format(dtVal) : null;
					break;
				default:
				}
				return value;
			},

			checkNavigationIntent: function (semanticObject, semanticAction, oController, callBack) {
				if (!sap.ushell && !semanticObject && !semanticAction) {
					return false;
				}

				var sIntent = "#" + semanticObject + "-" + semanticAction;
				var crossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
				var oDeferred = crossAppNavigator.isIntentSupported([sIntent], oController.getOwnerComponent());
				oDeferred.done($.proxy(function (oIntentSupported) {
					if (oIntentSupported && oIntentSupported[sIntent] && oIntentSupported[sIntent]["supported"] === true) {
						callBack(true);
					} else {
						callBack(false);
					}
				}, this));

			},

			moveArray: function (arr, oldIndex, newIndex) {
				while (oldIndex < 0) {
					oldIndex += arr.length;
				}
				while (newIndex < 0) {
					newIndex += arr.length;
				}
				if (newIndex >= arr.length) {
					var k = newIndex - arr.length;
					while ((k--) + 1) {
						arr.push(undefined);
					}
				}
				arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
			},

			getSortByValFunc: function (property) {
				return function (a, b) {
					if (a[property] > b[property]) {
						return 1;
					}
					if (a[property] < b[property]) {
						return -1;
					}
					// a must be equal to b
					return 0;
				};
			}
		};
	});