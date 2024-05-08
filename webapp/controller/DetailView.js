sap.ui.define([
		"sap/m/MessageBox",
		"sap/ui/layout/form/SimpleForm",
		"sap/m/Panel",
		"sap/ui/core/Title",
		"sap/m/Label",
		"sap/m/Text",
		"sap/m/Table",
		"sap/m/Column",
		"sap/ui/model/odata/ODataModel",
		"sap/ui/model/json/JSONModel",
		"brs_demo_tablemaster/controller/ActionClass",
		"brs_demo_tablemaster/utilities/Utilities",
		"brs_demo_tablemaster/utilities/Controls"
	],
	function (MessageBox, SimpleForm, Panel, Title, Label, Text, Table, Column, ODataModel, JSONModel, ActionClass, Utilities, Controls) {
		var detailFrag = {
			createDetailSection: function (variantData, detailParentC, item, oController) {
				/*get the information detail config from DetailViewID*/
				this.oController = oController;
				this.oBundle = this.oController.getView().getModel("i18n");
				this.variantData = variantData;
				this.item = item;
				this.parentC = detailParentC;
				detailParentC.setBusyIndicatorDelay(0);
				var detailBox = this.oController.getView().byId("idBRSPanelContainer");
				this.detailBox = detailBox;
				if (detailBox.getItems().length > 0) {
					detailBox.destroyItems();
				}
				detailBox.setBusyIndicatorDelay(0);
				detailBox.setBusy(true);
				var detailViewConfigService = oController.serviceURL + this.oController.basePath + "/HAA/services/GetConfig.xsjs?DetailView=" +
					variantData.DetailViewID;
				$.ajax({
					url: detailViewConfigService,
					type: "GET",
					context: this,
					contentType: "application/json",
					success: function (oData) {
						this.checkConfig(oData.results, detailParentC);
					},
					error: function (oErr) {
						MessageBox.alert("Could not fetch detail config Data");
					}
				});
			},

			checkConfig: function (data) {
				var formModel = new JSONModel();
				formModel.setData();
				this.oController.getView().setModel(formModel, "detailSectionFormModel");
				this.getFormData(data, $.proxy(function (oData) {
						if (oData.results) {
							var formData = oData.results[0];
							if (oData.results.length > 1) {
								//Merge Results if more than 2
								formData = this.mergeData(oData.results);
							}
							formModel.setData(formData);
							// jQuery.sap.log.info(oData.results[0]);
							formModel.refresh(true);
							if (data.Tabs && data.Tabs[0].TabID === "0") {
								//No Tabs
								this.filterField = data.FilterField;
								this.createFormsUI(data);
							} else {
								//Tabs Defined
								this.createTabsUI(data);
							}
						}
					}, this),
					$.proxy(function (oErr) {
						MessageBox.alert(this.oBundle.getProperty("err_gen"));
						this.detailBox.setBusy(false);
						jQuery.sap.log.error("Detail Data call Failed " + oErr.statusText);
					}, this));
			},

			mergeData: function (formData) {
				var newDataSet = JSON.parse(JSON.stringify(formData[0]));
				var vFields = this.variantData.Fields;
				vFields.forEach(function (field) {
					if (field.Aggr_Oper) {
						var sum = 0;
						//Measure. add all values
						formData.forEach(function (data) {
							if (data[field.Fieldname] && !isNaN(parseFloat(data[field.Fieldname], 10))) {
								sum = sum + parseFloat(data[field.Fieldname], 10);
							}
						}, this);
						newDataSet[field.Fieldname] = sum;
					} else {
						//Dimension. show the non null value
						var finalValue;
						formData.forEach(function (data) {
							finalValue = data[field.Fieldname] ? data[field.Fieldname] : finalValue;
						}, this);
						newDataSet[field.Fieldname] = finalValue;
					}
				}, this);

				return newDataSet;
			},

			createFormsUI: function (data) {
				var detailBox = this.oController.getView().byId("idBRSPanelContainer");
				if (detailBox.getItems().length > 0) {
					detailBox.destroyItems();
				}

				var sections = data.Tabs[0].Sections;
				if (sections && sections instanceof Array) {
					this.tableSections = [];
					sections.forEach(function (sectionData) {
						var dsFormPanel = new Panel({
							headerText: sectionData.SectionDescription,
							expandable: true,
							expanded: true,
							backgroundDesign: "Solid"
						}).addStyleClass("sapUiSizeCompact");
						//.addStyleClass("brsDetailViewPanel");
						/*Form Layout for Data*/
						if (sectionData && sectionData.SectionType && sectionData.SectionType.toLowerCase() ===
							"form") {

							var formData = sectionData.Fields;
							/*Get max of Form Columns*/
							var formCols = 2;
							//var maxid = 0;
							formData.map(function (obj) {
								if (parseInt(obj.FormColumn, 10) > formCols) formCols = obj.FormColumn;
							});

							var dsForm = new SimpleForm({
								editable: false,
								layout: "ResponsiveGridLayout",
								minWidth: 1024,
								maxContainerCols: formCols,
								labelSpanXL: 4,
								labelSpanL: 3,
								labelSpanM: 4,
								emptySpanXL: 0,
								emptySpanL: 0,
								emptySpanM: 0,
								columnsXL: formCols,
								columnsL: formCols,
								columnsM: formCols,
								singleContainerFullSize: true
							}).addStyleClass("sapUiSizeCompact").addStyleClass("detailViewForm");
							dsFormPanel.addContent(dsForm);
							// dsForm.addContent(new Title({
							// 	level: "Auto"
							// }));
							
							for (var i = 1; i <= formCols; i++) {
								dsForm.addContent(new Title({
									level: "Auto"
								}));
								
								formData.forEach(function (formItem) {
									if (formItem.FormColumn === i) {
										var UIControl = new sap.m.Text({
											wrapping: true,
											customData: [new sap.ui.core.CustomData({
												key: "fieldData",
												value: formItem
											})]
										}).bindProperty("text", {
											path: "detailSectionFormModel>/" + formItem.Fieldname,
											formatter: function (oVal) {
												var fieldData = this.data("fieldData"),
													fieldType = fieldData.FieldType,
													formatStyle = fieldData.FormatStyle,
													fracDigits = fieldData.DecPlaces;
												return Utilities.formatValue(oVal, fieldType, formatStyle, fracDigits);
											}
										});

										var formLbl = new Label({
											text: formItem.FieldDescription,
											tooltip: formItem.FieldDescription
										}).addStyleClass("sapUiTinyMarginBottom");
										//.addStyleClass("brsTableMasterDVFormLbl");

										if (formItem.FieldType === "link") {
											UIControl = new sap.m.Link({
												text: "{detailSectionFormModel>/" + formItem.Fieldname + "}",
												tooltip: "{detailSectionFormModel>/" + formItem.Fieldname + "}",
												customData: new sap.ui.core.CustomData({
													key: "detailPopup",
													value: formItem
												})
											});
											UIControl.setBusyIndicatorDelay(0);
											UIControl.attachPress(this.openPopup, this);
										} else if (formItem.FieldType === "button") {
											UIControl = new sap.m.Button({
												width: "auto",
												text: formItem.FieldDescription,
												customData: [new sap.ui.core.CustomData({
														key: "actionBtn",
														value: formItem
													}),
													new sap.ui.core.CustomData({
														key: "variantData",
														value: this.variantData
													})
												],
												press: this.oController.onActionBtnPress.bind(this.oController)
											});
											// UIControl.attachPress(this.openPopup, this);
										}
										dsForm.addContent(formLbl).addContent(UIControl);
									}
								}, this);
							}

							//End of a section creation
							detailBox.addItem(dsFormPanel);
						}
						/*Table View for detail section*/
						else if (sectionData && sectionData.SectionType && sectionData.SectionType.toLowerCase() === "table") {
							var dSC = new sap.m.ScrollContainer({
								width: "100%",
								height: "100%",
								vertical: true,
								horizontal: true
							});
							dsFormPanel.addContent(dSC);
							var dTbl = new sap.m.Table({
								inset: true,
								width: "100%",
								growing: true,
								growingThreshold: 100,
								updateFinished: function (oEvt) {
									oEvt.getSource().setBusy(false);
								}
							});
							//.addStyleClass("persoTableStyle");
							dSC.addContent(dTbl);
							detailBox.addItem(dsFormPanel);
							this.getVariantConfig(sectionData, dSC, dTbl);
							var tbObj = {
								"sectionData": sectionData,
								"dsFormPanel": dsFormPanel,
								"dsc": dSC,
								"dTbl": dTbl
							};
							this.tableSections.push(tbObj);
						}
					}, this);
				}
				detailBox.setBusy(false);
			},

			getVariantConfig: function (sectionData, dSC, dTbl) {
				var appID = sectionData.Fields[0].TableAppID;
				var appVariantID = sectionData.Fields[0].TableAppVariantID;
				if (appID && appVariantID) {
					dTbl.setBusy(true);
					// jQuery.sap.delayedCall(0, this, function() {
					var url = this.oController.serviceURL + this.oController.basePath + "/HAA/services/GetConfig.xsjs?AppID=" + appID +
						"&AppVariantID=" + appVariantID;
					$.ajax({
						url: url,
						type: "GET",
						context: this,
						contentType: "application/json",
						success: function (oData) {
							if (oData.results && oData.results.Variants && oData.results.Variants.length && oData.results.Variants.length > 0) {
								var variantData = oData.results.Variants[0];
								this.loadTable(variantData, dTbl);
							}
						},
						error: function (oErr) {
							dSC.setBusy(false);
							jQuery.sap.log.error("Could not fetch Data for the Detail View Table for AppId/AppVariantID " + appID + "/" + appVariantID,
								this.oController.getOwnerComponent());
						}
					});
					// });
				}
			},

			loadTable: function (variantData, dTbl) {
				var tableDataModel, fields;
				var bindObject;
				var params = {
					selectArr: [],
					sorter: [],
					filter: []
				};

				var service = variantData.Service,
					dataPath = variantData.ServEntity;
				fields = variantData.Fields;
				var modelObj = {
					json: true,
					defaultCountMode: sap.ui.model.odata.CountMode.None,
					useBatch: false,
					disableHeadRequestForToken: true
				};
				/*Clear if any previous Tables*/
				if (dTbl.getColumns().length > 0) {
					dTbl.destroyColumns();
				}
				if (dTbl.getItems().length > 0) {
					dTbl.destroyItems();
				}
				tableDataModel = new sap.ui.model.odata.v2.ODataModel(this.oController.serviceURL + service, modelObj);

				dTbl.setModel(tableDataModel);
				dTbl.addCustomData(new sap.ui.core.CustomData({
					key: "dTblVariant",
					value: variantData
				}));

				var template = new sap.m.ColumnListItem({
					type: "Inactive"
				});

				fields.forEach(function (field) {
					if (field.Visible && field.Visible.toLowerCase() === "true") {
						var isMeasure = field.Aggr_Oper ? true : false;
						var width = (field.ColumnWidth && !isNaN(parseFloat(field.ColumnWidth, 10))) ? (parseFloat(field.ColumnWidth, 10) * 10) :
							180;
						var column = new sap.m.Column({
							width: width + "px",
							hAlign: isMeasure === true ? "End" : "Begin",
							vAlign: "Middle"
						});
						column.setHeader(new sap.m.Text({
							width: "100%",
							text: field.FieldDescription
								// textAlign: "Center"
						}));
						column.setVisible(field.Fieldname === "#GROUPINGID" ? false : true);
						if (!field.FieldType || (field.FieldType.toLowerCase() !== "button" && field.FieldType.toLowerCase() !== "seg_button" && field.FieldType
								.toLowerCase() !== "dialoginput" && field.FieldType.toLowerCase() !== "input")) {
							params.selectArr.push(field.Fieldname);
						}
						// params.selectParams += field.Fieldname + ",";

						/*Different Types of Controls*/
						var cell;
						switch (field.FieldType) {
						case "button":
							cell = Controls.button(field, variantData, this.oController);
							break;
						default:
							cell = new sap.m.Text({
								width: "100%",
								customData: [new sap.ui.core.CustomData({
									key: "fieldData",
									value: field
								})]
							}).bindProperty("text", {
								path: field.Fieldname,
								formatter: function (cellVal) {
									var fieldData = this.data("fieldData"),
										fieldType = fieldData.FieldType,
										formatStyle = fieldData.FormatStyle,
										fracDigits = fieldData.DecPlaces,
										value = cellVal;
									var bindingPath = this.getBinding("text").sPath;
									if (bindingPath === "#GROUPINGID") {
										if (cellVal !== null) {
											var item = this.getParent();
											item.setType(sap.m.ListType.Inactive);
											item.rerender();
											item.addStyleClass("brsSubTotalRow").addStyleClass("brsDefaultCursor");
										}
									}
									if (value && fieldType && fieldType.toLowerCase() === "date" && value.match && value.match(/Date/gi)) {
										value = parseInt(value.substr(6), 10);
									}
									value = Utilities.formatValue(value, fieldType, formatStyle, fracDigits);
									return value;
								}
							});
						}
						template.addCell(cell);
						dTbl.addColumn(column);
					}
				}, this);

				bindObject = {
					path: "/" + dataPath,
					template: template
				};
				var selectStr = "";
				if (params.selectArr && params.selectArr.length && params.selectArr.length > 0) {
					params.selectArr.forEach(function (selItem) {
						selectStr += selItem + ",";
					}, this);
					//Remove the last Comma
					selectStr = selectStr.replace(/,([^,]*)$/, "");
					bindObject.parameters = {
						select: selectStr,
						custom: {
							AppID: variantData.AppID,
							AppVariantID: variantData.AppVariantID
						}
					};
				}

				var dtViewFilter, dtSorter;
				dtViewFilter = this.getDtViewFilter();
				if (dtViewFilter) {
					params.filter.push(dtViewFilter);
				}
				if (dtSorter) {
					bindObject.sorter = dtSorter;
				}

				if (params.filter.length > 0) {
					bindObject.filters = params.filter;
				}
				dTbl.bindAggregation("items", bindObject);
			},

			getDtViewFilter: function (fltrFieldValue) {
				var oDataFilterArr = [],
					finalFilter;

				var filterField = fltrFieldValue || this.filterField;
				var filterArr = filterField.split(",");

				if (filterArr && filterArr.length && filterArr.length > 0) {
					//get the value for filterField property
					var cells = this.item.getCells();

					//Form the filters
					filterArr.forEach(function (filterObj) {
						var filterValue = cells.filter(function (oCell) {
							if (oCell.getBindingPath("text") === filterObj.trim()) {
								return oCell.getText();
							}
						}, this);

						if (filterValue && filterValue[0]) {
							oDataFilterArr.push(new sap.ui.model.Filter({
								path: filterObj.trim(),
								operator: sap.ui.model.FilterOperator.EQ,
								value1: filterValue[0].getText()
							}));
						}
					}, this);

					if (oDataFilterArr && oDataFilterArr.length > 0) {
						finalFilter = new sap.ui.model.Filter({
							filters: oDataFilterArr,
							and: true
						});
					}
				}
				return finalFilter;
			},

			openPopup: function (oEvt) {
				//popup variant.
				if (!this._dvPopup) {
					this._dvPopup = sap.ui.xmlfragment("brs_demo_tablemaster.fragments.DetailPopup", this.oController);
					this._dvPopup.setBusyIndicatorDelay(0);
					this.oController.getView().addDependent(this._dvPopup);
				}
				this._dvPopup.destroyContent();
				var src = oEvt.getSource();
				src.setBusyIndicatorDelay(0);
				src.setBusy(true);
				var dtlData = oEvt.getSource().data("detailPopup");
				var appID, appVariantID;

				if (!dtlData) {
					jQuery.sap.log.error("no Popup data Defined for the clicked item", this.oController.getOwnerComponent());
					return;
				}

				var dvPopupForm = new SimpleForm({
					minWidth: 1024,
					maxContainerCols: 1,
					editable: false,
					layout: "ResponsiveGridLayout",
					labelSpanL: 3,
					labelSpanM: 3,
					emptySpanL: 4,
					emptySpanM: 4,
					columnsL: 1,
					columnsM: 1
				});
				this._dvPopup.addContent(dvPopupForm);

				appID = dtlData.TableAppID;
				appVariantID = dtlData.TableAppVariantID;

				if (appID && appVariantID) {
					this._dvPopup.setBusy(true);
					// this._dvPopup.openBy(src);
					var url = this.oController.serviceURL + this.oController.basePath + "/HAA/services/GetConfig.xsjs?AppID=" + appID +
						"&AppVariantID=" + appVariantID;
					$.ajax({
						url: url,
						type: "GET",
						context: this,
						contentType: "application/json",
						success: function (oData) {
							/*Variant Data Fetched. Start Creating Form*/
							if (oData && oData.results && oData.results.hasOwnProperty("Variants")) {
								var variantData = oData.results.Variants[0];
							}

							/*Get Detail popup Data*/
							var dvFormDModel = new JSONModel();
							dvFormDModel.setData();
							this.oController.getView().setModel(dvFormDModel, "dvPoupDetailModel");

							variantData.Fields.forEach(function (field) {
								if (field.Visible && field.Visible.toLowerCase() === "true") {
									var dvFLbl = new Label({
										text: field.FieldDescription
									});
									var dvTxt = new Text({
										// text: "{dvPoupDetailModel>/" + field.Fieldname + "}",
										wrapping: true,
										customData: [new sap.ui.core.CustomData({
											key: "fieldData",
											value: field
										})]
									}).bindText("dvPoupDetailModel>/" + field.Fieldname, function (cellVal) {
										var fieldData = this.data("fieldData"),
											fieldType = fieldData.FieldType,
											formatStyle = fieldData.FormatStyle,
											fracDigits = fieldData.DecPlaces;
										return Utilities.formatValue(cellVal, fieldType, formatStyle, fracDigits);
									});
									dvPopupForm.addContent(dvFLbl).addContent(dvTxt);
								}
							}, this);
							jQuery.sap.delayedCall(0, this, function () {
								if (src) {
									this._dvPopup.openBy(src);
									src.setBusy(false);
									/*Create the filter Param correctly. Might not always be global Filter Field*/
									var filterField = this.filterField,
										filterVal;
									if (src && src instanceof sap.m.Link) {
										var binding = src.getBinding("text");
										if (binding.getPath()) {
											filterField = binding.getPath().replace(/\//g, "");
										}
										filterVal = binding.getValue();
									}
									if (filterField && filterVal) {
										/*Data Call to fill the popup*/
										var opopModel = new ODataModel(this.oController.serviceURL + variantData.Service, {
											json: true
										});
										var opopFilter = new sap.ui.model.Filter({
											path: filterField,
											operator: sap.ui.model.FilterOperator.EQ,
											value1: filterVal
										});

										opopModel.read("/" + variantData.ServEntity, {
											filters: [opopFilter],
											success: $.proxy(function (oData) {
												if (oData && oData.d) {
													dvFormDModel.setData(oData.d.results[0]);
												} else {
													dvFormDModel.setData(oData.results[0]);
												}
												this._dvPopup.setBusy(false);
											}, this),
											error: $.proxy(function (oErr) {
												this._dvPopup.setBusy(false);
												jQuery.sap.log.error("Popup Data Error");
											}, this)
										});
									}
								}
							}, [src, variantData]);
						},
						error: function (oErr) {
							this._dvPopup.setBusy(false);
							jQuery.sap.log.error("Error fetching variant Data for appID/appVariantID : " + appID + "/" + appVariantID);
						}
					});

				}
			},

			getFormData: function (data, successCallBack, errCallBack) {
				var service = this.oController.serviceURL + this.variantData.Service;
				var formModel = new ODataModel(service, {
					json: true
				});

				var paramStr = this.oController.getParamterString(this.variantData.Fields);
				if (paramStr === false) {
					jQuery.sap.log.error("Parameter String not set in variant - " + this.variantData.AppVariantID + "/" + this.variantData.UsrVariantID);
					return;
				}

				var filter = this.getDtViewFilter(data.FilterField);

				if (filter) {
					formModel.read("/" + this.variantData.ServEntity, {
						urlParameters: ["AppID=" + this.oController.variantData.AppID, "AppVariantID=" + this.oController.variantData.AppVariantID],
						filters: [filter],
						success: successCallBack,
						error: errCallBack
					});
				} else {
					this.oController.getView().byId("idBRSPanelContainer").setBusy(false);
					jQuery.sap.log.error("No FilterVal found for Detail View");
					return;
				}
			},

			onActionBtnPress: function (oEvt) {
				var src = oEvt.getSource();
				var data = src.data();
				var listItem = this.item;
				// var detailListItem = oEvt.getSource().getEventing;
				ActionClass.actionBtnSetup(data, listItem, this.oController);
			}
		};
		return detailFrag;
	}, true);