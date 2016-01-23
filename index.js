// NPM modules
var fs = require('fs');
var util = require('util');
var fast_csv = require('fast-csv');
//var request = require('request');
var limiter = require('simple-rate-limiter');
var request = limiter(require('request')).to(3).per(1000).evenly(true);


// CSV file to look up address
var inputFile = 'INPUT.csv';
var outputFile = 'OUTPUT.tsv';
var outputInJson = true;

// Google API Key
var APIKEY = fs.readFileSync('APIKEY', 'utf8');

// Command Line Usage
if (process.argv.length == 2) {
    console.log('# Usage: node ' + process.argv[1].split('/').pop() + ' INPUT.csv OUTPUT.tsv');
    process.exit(0);
}

if (process.argv.length > 2) {
  inputFile = process.argv[2];
  console.log('# Input file: ' + inputFile);
}

if (process.argv.length > 3) {
  outputFile = process.argv[3];
  console.log('# Output file: ' + outputFile);
}

var outputStream = fs.createWriteStream(outputFile);


// Format in the style for Google Maps API
var reformat_address = function(address) {
    var clean_address = address
        .replace(/\s\s+/g,' ') // Remove Multiple White Spaces
        .replace(/\ /gi, '+'); // Replace Space with '+'

    var url_googleapis = 'https://maps.googleapis.com/maps/api/geocode/json?';
    var url_address = 'address=';
    var url_api_key = '&key=';

    // Build URL and send Google Maps request
    return url_googleapis + url_address + clean_address + url_api_key + APIKEY;
}

// Parse Google return response
var parse_formatted_address = function(info) {
    var lat, lng;
    if (info['results'][0] && info['results'][0]['formatted_address']) {
        // Fix the total size to 6 decimal positions, gives accuracy ~0.11 meters
        lat = Number((info['results'][0]['geometry']['location']['lat']).toFixed(6))
        lng = Number((info['results'][0]['geometry']['location']['lng']).toFixed(6))
    } else {
        console.log(info);
        lat = lng = 0;
    }
    return {'lat':lat, 'lng':lng};
}

// Lookup address with google maps api
var address_lookup = function(address, outputStream) {
    // Build URL and send Google Maps request
    request(reformat_address(address), function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body);

            var latlng = parse_formatted_address(info);
            var lat = latlng['lat'];
            var lng = latlng['lng'];

            console.log(lat + '\t' + lng + '\t' + address);

            if (outputInJson) {
                outputStream.write(util.format({'lat':lat, 'lng':lng, 'address':address}) + ',\n');
            }
            else {
                outputStream.write(util.format(lat + '\t' + lng + '\t' + address + '\n'));
            }

        }
        else {
            console.log('Error: ' + error);
            console.log('Status Code: ' + response.statusCode);
        }
    });
}

// Read CSV, for each line process the request and save it to a file.
fast_csv
    .fromPath(inputFile, {headers: true})
    .on('data', function(data) {
        address_lookup(data['address'], outputStream);
    })
    .on('end', function(){
    });