module.exports = function (grunt) {
	"use strict";
	grunt.loadNpmTasks("@sap/grunt-sapui5-bestpractice-build");
	grunt.option("force", 'on');
	grunt.registerTask("default", [
		"clean",
		"lint",
		"build"
	]);
};