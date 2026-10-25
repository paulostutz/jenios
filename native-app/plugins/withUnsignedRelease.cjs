const {withAppBuildGradle}=require('expo/config-plugins');
module.exports=config=>withAppBuildGradle(config,config=>{
 const original=config.modResults.contents;
 const start=original.indexOf('release {',original.indexOf('buildTypes'));
 if(start<0)throw Error('Review generated release configuration');
 const head=original.slice(0,start),tail=original.slice(start);
 const marker='// JENIOS: signed separately after verification, never with the public debug key.';
 if(!tail.includes(marker)&&!tail.includes('signingConfig signingConfigs.debug'))throw Error('Review Expo signing template');
 config.modResults.contents=head+tail.replace('signingConfig signingConfigs.debug',marker);
 return config;
});
