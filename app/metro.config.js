// Lets Metro bundle the offline dictionary (assets/dict.db) as an asset.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("db");

module.exports = config;
