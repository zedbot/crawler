var elasticsearch = require('elasticsearch');
var async = require('async');
var request = require('request');
var MongoClient = require('mongodb').MongoClient

var client = new elasticsearch.Client({
  host: 'localhost:9200',
  log: 'error'
});

var site = process.argv[2];
var type = process.argv[3];
var version = process.argv[4];
var batch_id = process.argv[5];
var targets = [];
console.log(process.argv);
for (var i = 6; i < process.argv.length; i++) {
    targets.push(process.argv[i]);
}

endpoints = {
	'live': {url:'https://business.napstock.com/api/'+site+'/v1/submit', type:"napstock_api"},
  'dev': {url:'http://merchantdev.napstock.com/api/'+site+'/v1/submit', type:"napstock_api"},
  'review':{url:'http://HuugoUss:KassipereKevadp2ev@40.113.20.90:8080/reviews/products', type:"rest"},
};



console.log("export", site, type, version);

var query = {"query":{"bool":{"must":[{"term":{"site":site}},{"term":{"batch_id":batch_id}}]}},"from":0,"size":5000,"sort":[],"facets":{}}

  client.search({
    index: 'zedbot_page',
    type: type,
    body: query
  } ).then(function (resp) {
   console.log(JSON.stringify(query, "  "));
    var docs = [];
    for (var page_hit of resp.hits.hits) {
      docs.push(JSON.stringify(page_hit._source));
    }
    if(docs.length == 0) return;
    
    console.log("Num items to be posted: " + docs.length);
    for (var target of targets) {
      console.log(target);
      if (endpoints[target]) {
        var target_url = endpoints[target].url;
        var target_type = endpoints[target].type;
        console.log(target_url)
      
        if(target_type =="mongodb") {
            MongoClient.connect(target_url, function(err, db) {
              console.log("Connected correctly to server");
                      console.log(err, docs[0]);
              var collection = db.collection('products');
              // Insert some documents
              async.eachSeries(docs, function(doc, callback) {
                 collection.insert(page_hit._source.doc.product, function(err, result) {
                   console.log("response for", target);
                  console.log(result); 
                  console.log(err); 
                  callback();
                 });
              }, function(err){
                db.close();
              });
            });
        
        } else if(target_type =="rest") {
           post_data = '[' + docs.join(",\n") + ']';
           async.eachSeries(docs, function(doc, callback) {
            request({
              uri: target_url,
              method: "POST",
             rejectUnauthorized: false,
                  requestCert: true,              
              headers: {
               // 'Authorization': 'AuthSub token=crawler@zed.ee-JnLWUKFHRnBV9vmdA6Ec',
                'Content-Type': 'application/json',
                'x-filename': batch_id+'.json'
              },
              body: doc
            }, function (error, response, body) {
                console.log("response for", target);
                //console.log(response); 
                console.log(body); // Show the HTML for the Google homepage.
                callback();
            });    
           });
        } else {
          post_data = docs.join("\n");
           
          request({
            uri: target_url,
            method: "POST",
            rejectUnauthorized: false,
            requestCert: true,              
            headers: {
              'Authorization': 'AuthSub token=crawler@zed.ee-JnLWUKFHRnBV9vmdA6Ec',
              'Content-Type': 'zedbot/'+type,
              'x-filename': batch_id+'.json'
            },
            body: post_data
          }, function (error, response, body) {
            console.log("response for", target);
            console.log(response); 
            console.log(body); // Show the HTML for the Google homepage.
          });
        }
           
      }
    } // end for targets
   //console.log(JSON.stringify(resp, "  "));
  })