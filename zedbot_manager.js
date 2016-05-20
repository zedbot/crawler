var elasticsearch = require('elasticsearch');
var async = require('async');
var exec    = require('child_process').exec;
var spawn = require('child_process').spawn;
var uuid = require('node-uuid');

var client = new elasticsearch.Client({
  host: 'localhost:9200',
  log: 'error'
});
var crypto = require('crypto');
  
client.search({
  index: 'zedbot_site',
//  type: site,
  body: {version: true, query: {term : { enabled: true}	}, size:100 }
}
).then(function (resp) {
	var sites = [];
	resp.hits.hits.map( function(hit) {
        //console.log(hit);
        var batch_id = uuid.v1().replace(/-/g,'_');
        var cmd = '/home/zedbot/zedbot-scraper/zedbot.sh';
        params = [hit._id, hit._type, hit._version, batch_id, ' start']
        if (hit._source.export != undefined && hit._source.export.dev == true) params.push('dev')
        if (hit._source.export != undefined && hit._source.export.live) params.push('live')
        if (hit._source.export != undefined && hit._source.export.review) params.push('review')
        console.log(cmd, params.join(' '));
    
        spawn(cmd, params, {
            stdio: 'ignore', // piping all stdio to /dev/null
            detached: true            
        }).unref();
        
	});
	
}, function (err) {
    console.trace(err.message);
});


console.info("should I wait?")
