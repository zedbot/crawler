var elasticsearch = require('elasticsearch');
var async = require('async');
var cheerio = require('cheerio'),
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
	'user-agent': 'ZedBot/2.0 (http://crawler.zed.ee)'
};

var site = process.argv[2];
var type = process.argv[3];
var version = process.argv[4];
var batch_id = process.argv[5];

console.log("zedbot", site, type, version);
if (version == undefined) {
    version = 1;
}
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
            scripts: ["http://crawler.zed.ee/scraper.js"],
            done: function(err, window) {
                console.log("jsdom.done, error: ", err);
                if(window != null)
                    callback(null, window);
                else {
                  var task = {
                    index: 'zedbot_page',
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
          console.log(JSON.stringify(doc, null, ' '));
          var es_q = async.queue(function (task, _callback) {
             //console.log(task);
             client.update(task , function (error, response) {
                    if(error != undefined)
                      console.trace(error);
                      _callback();
              });
          } , 1);
        // links & pagination
        var template = doc.template;
        for(var xpath in doc.links) {
            var links = doc.links[xpath];
            //console.log("====" + xpath);
            for (var i =0;i<links.length;i++) {
              if(links[i] == undefined) continue;
              //console.log("-->" + JSON.stringify(links[i]));
              es_q.push({
                index: 'zedbot_links',
                type: type,
                id: crypto.createHash('md5').update(links[i].href).digest('hex'),
                body: {
                  script : "ctx._source.last_found = _found; ",
                  params: {
                    _found: new Date(),
                    title: [links[i].title]
                  },
                  upsert:{
                    site: doc.site,
                    navigation: [{
                      referer: url,
                      xpath: xpath,
                      //template: template,
                      id: crypto.createHash('md5').update(url).digest('hex'),
                      title: links[i].title
                    }],
                    url: links[i].href,
                    score:doc.score,
                    found: new Date()
                  }
                }
              });
            }
          }
        
            // link data
          es_q.push({
            index: 'zedbot_links',
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
                    first_scraped: new Date(),
                    last_scraped: new Date(),
                    version: version,
                    batch_id: batch_id,
                    template: doc.links.keys
                }
            }
     
        });
        // canonical url
          if (doc.canonical != undefined && doc.canonical != '') {
               es_q.push({
                index: 'zedbot_links',
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
          
          
          if(doc.score >0.5) {
            site = doc.site
          doc = doc.document;
          doc.site = site;
          //subproducts !!! this specific stuff should not be here
          if(doc.product != undefined && doc.product.sub_product != undefined) {
              if(doc.product.sub_product.length > 1 && doc.product.ean == undefined) {
                  delete doc.product.ean;
              }
              for(var i in doc.product.sub_product) {
                var newObject = extend(true, {}, doc, {product: doc.product.sub_product[i]});
                //console.log("newObject", newObject);
                var newurl = url + "#"+escape(newObject.product.code);
                delete newObject.product.sub_product;
                  // page data
                  es_q.push({
                    index: 'zedbot_page',
                    type: type,
                    id: crypto.createHash('md5').update(newurl).digest('hex'),
                    body: {
                  
                          script : "ctx._source.last_scraped = _last_scraped;ctx._source.doc = _doc; ctx._source.version = _version; ctx._source.batch_id = _batch_id",
                          params: {
                            _last_scraped: new Date(),
                            _doc: newObject,
                            _version: version,
                            _batch_id: batch_id
                         },
                        upsert: {
                            url: newurl,
                            site: doc.site,
                            doc:newObject,
                            first_scraped: new Date(),
                            last_scraped: new Date(),
                            version: version,
                            batch_id: batch_id
                        }
                    }
                 });  
              }
              delete doc.product;
          }
          // page data
          var doc_id = crypto.createHash('md5').update(url).digest('hex');
            console.log("save document!", type, doc.site, doc_id, url);          
          es_q.push({
            index: 'zedbot_page',
            type: type,
            id: doc_id,
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
                    doc:doc,
                    first_scraped: new Date(),
                    last_scraped: new Date(),
                    version: version,
                    batch_id: batch_id
                }
            }
          });
          }//end if score  
          es_q.drain = function() {
            console.log('all items have been sent to elastic');
            callback(null, 'done');
          };
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
    index: 'zedbot_links',
    type: type,
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
			var waitTime = (Math.random()*300000 + 20000);
      if(page_hit._source.crawl_rate !== undefined) {
        if(page_hit._source.crawl_rate == 'fast'){
          waitTime = (Math.random()*30000 + 20000);
        }
      }
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



console.info("should I wait?")
