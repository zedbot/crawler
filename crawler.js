var elasticsearch = require('elasticsearch');
var async = require('async');
var jsdom = require('jsdom');
var jQuery = require("jquery");
var extend = require("extend");
var exit = false;
process.on('uncaughtException', function (err) {
  console.error('CAUGHT', err.stack);
 // process.exit(1);
 exit = true;
});

//require("node-jquery-xhr")
XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest
var cookieJar = jsdom.createCookieJar();
var client = new elasticsearch.Client({
  host: 'localhost:9200',
  log: 'error'
});
var crypto = require('crypto');
  
var headers = {
	'user-agent': 'ZedBot/2.1 (http://crawler.zed.ee)'
};

var site = process.argv[2];
var version = process.argv[4];
var batch_id = process.argv[5];

function scrape(url, type, headers, level, scrape_done) {

  async.waterfall([
      // load page
      function(callback) {

          jsdom.env({
            url: url,
            cookieJar: cookieJar,
            headers: headers,
              features: {
                  FetchExternalResources   : ["script"],
                  ProcessExternalResources : ["script"],
                MutationEvents           : '2.0'
              },
            scripts: ["http://crawler.zed.ee/scraper2.js"],
            done: function(err, window) {
                console.log("jsdom.done, error: ", err);
                if(window != null)
                    callback(null, window);
                else {
                  var task = {
                    index: 'zedbot_links',
                    type: type,
                    id: crypto.createHash('md5').update(url).digest('hex'),
                    body: {
                      script : "ctx._source.last_scraped = _last_scraped; ctx._source.version = _version;",
                      params: {
                        _last_scraped: new Date(),
                        _version: version
                      }
                    }
                  };
                  client.update(task , function (error, response) {
                          if(error != undefined)
                            console.trace(error);
                  });
                  callback(err);
                }
            }
          });
      },
      // add scraper
      function(window, callback) {
          console.info("page loaded");
              jsdom.getVirtualConsole(window).sendTo(console);
              window.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
              window.onerror = function (msg) { console.log("onerr", msg) }
              window.zedBotReady = function() {
                console.log("zedBotReady")
                var product = window.zedBot.parse();
               // console.log(JSON.stringify(product, null, ' '));
                callback(null, product);
              }
              //console.log('errors:', errors);
              $ = jQuery(window);
              $.support.cors = true;
              $.ajaxSettings.xhr = function () {return new XMLHttpRequest;};
              
              window.zedBot.init(type, 'node-js', $);
              console.log(window.zedBot);
      },
      //proccess product
      function(doc, callback) {
          console.info("proccess product");
          console.log(doc);
          var es_q = async.queue(function (task, _callback) {
             console.log(task);
             client.update(task , function (error, response) {
                    if(error != undefined)
                      console.trace(error);
                      _callback();
            });
          } , 1);
		  
        // canonical url
          if (doc.canonical != undefined && doc.canonical != '') {
               es_q.push({
                index: 'zedbot_page',
                type: type,
                id: crypto.createHash('md5').update(url).digest('hex'),
                body: {
					script : "ctx._source.last_scraped = _last_scraped; ctx._source.version = _version;",
					params: {
					  _last_scraped: new Date(),
					  _version: version
					},
					upsert: {
					  url: url,
					  site: doc.site,
					  redirect: doc.canonical,
					  //doc:doc,
					  first_scraped: new Date(),
					  last_scraped: new Date(),
					  version: version
					}
                }
              });
           
            url = canonical;
          }
/*
          // page data
          es_q.push({
            index: 'zedbot_page',
            type: type,
            id: crypto.createHash('md5').update(url).digest('hex'),
            body: {
          
                  script : "ctx._source.last_scraped = _last_scraped;ctx._source.doc = _doc; ctx._source.version = _version; ctx._source.batch_id = _batch_id",
                  params: {
                    _last_scraped: new Date(),
                    _doc: doc,
                    _version: version,
                    _batch_id: batch_id
                 },
                upsert: {
                    url: url,
                    site: doc.site,
                    level: level,
                    doc:doc,
                    first_scraped: new Date(),
                    last_scraped: new Date(),
                    version: version,
                    batch_id: batch_id
                }
            }
          });
          
          es_q.drain = function() {
            console.log('all items have been sent to elastic');
            callback(null, 'done');
          };
		  */
      }
  ], function (err, result) {
      console.log(err);
	  scrape_done()
      // result now equals 'done'    
  });

}

var query = {
		query: {
		function_score: {
			query: {
			match_all:{}},
			filter: {
			  bool: {
				must: [
					{
					  term: { site: site }
					}
				],
				should:[
					{
					  missing: { field: "last_scraped" }
					},
					{
					  missing: { field: "version" }
					},
					{
					  range: { version: { "lt": version} }
					},
					{
					  range: { last_scraped: { "lt": "now-14d"} }
					}
				],
			  }
			},
			functions: [
				{
					random_score: { 
						seed:  Math.random().toString()
					}
				}
			]
		}
		}
	};
	
client.search({
    index: 'zedbot_site',
    body: {
      query: { term: { _id: site } }
    }
}).then(function (resp) {
	var selectors = {};
	for (var i in resp.hits.hits) {
		//console.log(JSON.stringify(resp.hits.hits[i]._source.children, "  "));
		for (var key in resp.hits.hits[i]._source.children) {
			if (key == "follow_links") continue;
			if (key == "language") continue;
			if (key == "breadcrumbs") continue;
			console.log(resp.hits.hits[i]._type, '-', key, resp.hits.hits[i]._source.children[key].selector);
			selectors[resp.hits.hits[i]._type] = resp.hits.hits[i]._source.children;
		}
	}
  client.search({
    index: 'zedbot_links',
    body: query
  } ).then(function (resp) {
   console.log(JSON.stringify(query, "  "));
   async.eachSeries(resp.hits.hits, function(page_hit, callback) {
		var myheaders = headers;
		if(page_hit._source.referer != undefined) {
			myheaders.referer = page_hit._source.referer;
		}
		console.info("scraping ...", page_hit._id, page_hit._source.url);
		scrape(page_hit._source.url, page_hit._type, myheaders, page_hit._source.level, function() {
			var waitTime = (Math.random()*600000 + 20000);
            var s = new Date();
            var e = new Date();
            e.setTime(s.getTime()+waitTime);
			console.log("sleeping from " +  s.toString());
            console.log("           to " +  e.toString());
			setTimeout(function(){callback()}, waitTime);
		});
	   
   }, function(err){
		// if any of the file processing produced an error, err would equal that error
		console.log(err);
		if( err ) {
		  // One of the iterations produced an error.
		  // All processing will now stop.
		  console.log('A file failed to process');
		} else {
		  console.log('All files have been processed successfully');
		}
    //if(exit) {
    //  console.log("exiting");
      process.exit(1);
    //}

	});
  }, function (err) {
    console.trace(err.message);
  });
