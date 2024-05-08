sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/odata/ODataModel"
], function (JSONModel, ODataModel, Utilities) {
	return {
		singleMultiFilters: function (content, controlType) {
			var dataF = content.getItems()[1],
				retArr = [];
			if (dataF && (dataF instanceof sap.m.ComboBox || dataF instanceof sap.m.MultiComboBox || dataF instanceof sap.m.MultiInput)) {
				var fieldname = dataF.data("fltrLoadInfo").Fieldname;
				var selectedKeys = [];
				if (dataF instanceof sap.m.MultiInput) {
					var tokens = dataF.getTokens();
					tokens.forEach(function (token) {
						selectedKeys.push(token.getKey());
					}, this);
				} else {
					if (controlType === "Multi") {
						selectedKeys = dataF.getSelectedKeys();
					} else if (controlType === "Single" && dataF.getSelectedKey()) {
						selectedKeys = [dataF.getSelectedKey()];
					}
				}
				if (selectedKeys.length > 0) {
					//loop through the current Filter
					for (var i = 0; i < selectedKeys.length; i++) {
						var currKey = selectedKeys[i];
						//manage "'" in the string
						if (currKey.indexOf("'") > -1) {
							currKey = currKey.replace(/'/g, "\''");
						}
						if (currKey !== "All") {
							retArr.push({
								"Fieldname": fieldname,
								"filter_op": "eq",
								"val_low": currKey,
								"val_high": null
							});
						}
					}
				}
			}
			return retArr;
		},

		rangeFilters: function (content) {
			var dataF = content.getItems()[1],
				retArr = [];
			if (dataF && dataF instanceof sap.m.VBox) {
				var items = dataF.getItems();
				var fromCtrl = items[1];
				var toCtrl = items[3];
				var fieldname = fromCtrl.data("fltrLoadInfo").Fieldname;
				var fromVal = fromCtrl.getSelectedKey();
				var toVal = toCtrl.getSelectedKey();
				if (fromVal && toVal) {
					retArr.push({
						"Fieldname": fieldname,
						"filter_op": "bt",
						"val_low": fromVal,
						"val_high": toVal
					});
				}
			}
			return retArr;
		},

		numberRangeFilters: function (content) {
			var dataF = content.getItems()[1],
				retArr = [];
			if (dataF && dataF instanceof sap.m.VBox) {
				var items = dataF.getItems();
				var fromCtrl = items[1];
				var toCtrl = items[3];
				var fieldname = fromCtrl.data("fltrLoadInfo").Fieldname;
				var fromVal = (fromCtrl && fromCtrl.getValue() && !isNaN(parseFloat(fromCtrl.getValue()))) ? fromCtrl.getValue() : undefined;
				var toVal = (toCtrl && toCtrl.getValue() && !isNaN(parseFloat(toCtrl.getValue(), 10))) ? toCtrl.getValue() : undefined;
				if (fromVal && toVal) {
					retArr.push({
						"Fieldname": fieldname,
						"filter_op": "bt",
						"val_low": fromVal,
						"val_high": toVal
					});
				} else if (fromVal) {
					retArr.push({
						"Fieldname": fieldname,
						"filter_op": "ge",
						"val_low": fromVal
					});
				} else if (toVal) {
					retArr.push({
						"Fieldname": fieldname,
						"filter_op": "le",
						"val_low": toVal
					});
				}
			}
			return retArr;
		},

		rangeDateFilters: function (content) {
			var dataF = content.getItems()[1],
				retArr = [],
				fieldname = dataF.data("fltrLoadInfo").Fieldname,
				low, high;
			if (dataF && dataF instanceof sap.m.DateRangeSelection) {
				low = (dataF.getDateValue()) ? dataF.getDateValue() : null;
				high = (dataF.getSecondDateValue()) ? dataF.getSecondDateValue() : null;
				if (low && high) {
					var lowM = ((parseInt(low.getMonth(), 10) + 1) < 10) ? "0" + (parseInt(low.getMonth(), 10) + 1) : (parseInt(low.getMonth(),
						10) + 1);
					var highM = ((parseInt(high.getMonth(), 10) + 1) < 10) ? "0" + (parseInt(high.getMonth(), 10) + 1) : (parseInt(high.getMonth(),
						10) + 1);
					retArr.push({
						"Fieldname": fieldname,
						"filter_op": "bt",
						"val_low": low.getFullYear() + "-" + lowM + "-" + low.getDate(),
						"val_high": high.getFullYear() + "-" + highM + "-" + high.getDate()
					});
				}
			}
			return retArr;
		},

		specialRangeFilters: function (content) {
			var dataF = content.getItems()[1],
				retArr = [],
				lowSR, highSR;
			if (dataF instanceof sap.m.ComboBox || dataF instanceof sap.m.MultiComboBox) {
				var rangeVB = dataF.getParent().getItems()[2];
				var fieldname = dataF.data("fltrLoadInfo").Fieldname;
				var itemsSR = rangeVB.getItems();
				itemsSR.forEach(function (itemObj) {
					if (itemObj instanceof sap.m.ComboBox) {
						var cData = itemObj.data("splFieldKey");
						if (cData === "from") {
							lowSR = itemObj.getSelectedKey();
						} else {
							highSR = itemObj.getSelectedKey();
						}
					}
				}, this);
				if (lowSR && highSR) {
					retArr.push({
						"Fieldname": fieldname,
						"filter_op": "bt",
						"val_low": lowSR,
						"val_high": highSR
					});
				} else if (lowSR) {
					retArr.push({
						"Fieldname": fieldname,
						"filter_op": "eq",
						"val_low": lowSR
					});
				} else if (highSR) {
					retArr.push({
						"Fieldname": fieldname,
						"filter_op": "eq",
						"val_low": lowSR
					});
				}
			}

			return retArr;
		},

		specialWOStatusFilters: function (content) {
			var dataF = content.getItems()[1],
				retArr = [];
			if (dataF instanceof sap.m.ComboBox || dataF instanceof sap.m.MultiComboBox) {
				var childVB = dataF.getParent().getItems()[2];

				var woStatusCtrl = childVB.getItems()[1];
				var woDueDateCtrl = childVB.getItems()[3];
				//Update Work Order Status Data
				if (woStatusCtrl instanceof sap.m.MultiComboBox) {
					woStatusCtrl.getSelectedKeys().forEach(function (key) {
						retArr.push({
							"Fieldname": "WorkOrderStatus",
							"filter_op": "eq",
							"val_low": key
						});
					}, this);
				}

				//Update Work order Due Date Data
				if (woDueDateCtrl instanceof sap.m.DateRangeSelection) {
					var fromDateValue = woDueDateCtrl.getDateValue();
					var toDateValue = woDueDateCtrl.getSecondDateValue();
					var fromDtM, toDtM;
					if (fromDateValue && toDateValue) {
						fromDtM = ((parseInt(fromDateValue.getMonth(), 10) + 1) < 10) ? "0" + (parseInt(fromDateValue.getMonth(), 10) + 1) : (
							parseInt(fromDateValue.getMonth(), 10) + 1);
						toDtM = ((parseInt(toDateValue.getMonth(), 10) + 1) < 10) ? "0" + (parseInt(toDateValue.getMonth(), 10) + 1) : (parseInt(
							toDateValue.getMonth(), 10) + 1);
						retArr.push({
							"Fieldname": "CustomerSLA2DueDate",
							"filter_op": "bt",
							"val_low": fromDateValue.getFullYear() + "-" + fromDtM + "-" + fromDateValue.getDate(),
							"val_high": toDateValue.getFullYear() + "-" + toDtM + "-" + toDateValue.getDate()
						});
					} else if (fromDateValue) {
						fromDtM = ((parseInt(fromDateValue.getMonth(), 10) + 1) < 10) ? "0" + (parseInt(fromDateValue.getMonth(), 10) + 1) : (
							parseInt(fromDateValue.getMonth(), 10) + 1);
						retArr.push({
							"Fieldname": "CustomerSLA2DueDate",
							"filter_op": "le",
							"val_low": fromDateValue.getFullYear() + "-" + fromDtM + "-" + fromDateValue.getDate()
						});
					}
				}
			}

			return retArr;
		},

		specialAssetDateFilters: function (content) {
			var dataF = content.getItems()[1],
				retArr = [];
			if (dataF instanceof sap.m.ComboBox || dataF instanceof sap.m.MultiComboBox) {
				var fieldname = dataF.data("fltrLoadInfo").Fieldname;
				var assetDueDateCtrl = content.getItems()[2];
				if (assetDueDateCtrl && assetDueDateCtrl instanceof sap.m.DateRangeSelection) {
					var fromDtM, toDtM;
					var fromDateValue = assetDueDateCtrl.getDateValue();
					var toDateValue = assetDueDateCtrl.getSecondDateValue();
					if (fromDateValue && toDateValue && fromDateValue < toDateValue) {
						fromDtM = ((parseInt(fromDateValue.getMonth(), 10) + 1) < 10) ? "0" + (parseInt(fromDateValue.getMonth(), 10) + 1) : (
							parseInt(fromDateValue.getMonth(), 10) + 1);
						toDtM = ((parseInt(toDateValue.getMonth(), 10) + 1) < 10) ? "0" + (parseInt(toDateValue.getMonth(), 10) + 1) : (parseInt(
							toDateValue.getMonth(), 10) + 1);
						retArr.push({
							"Fieldname": fieldname,
							"filter_op": "bt",
							"val_low": fromDateValue.getFullYear() + "-" + fromDtM + "-" + fromDateValue.getDate(),
							"val_high": toDateValue.getFullYear() + "-" + toDtM + "-" + toDateValue.getDate()
						});
					} else if (fromDateValue || (fromDateValue && toDateValue && fromDateValue === toDateValue)) {
						fromDtM = ((parseInt(fromDateValue.getMonth(), 10) + 1) < 10) ? "0" + (parseInt(fromDateValue.getMonth(), 10) + 1) : (
							parseInt(fromDateValue.getMonth(), 10) + 1);
						retArr.push({
							"Fieldname": fieldname,
							"filter_op": "le",
							"val_low": fromDateValue.getFullYear() + "-" + fromDtM + "-" + fromDateValue.getDate()
						});
					}
				}
			}

			return retArr;

		}
	};
});