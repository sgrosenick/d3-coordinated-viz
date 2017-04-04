//wrap everthing in a self-executing anonymous function to move to local scope
(function(){

//pseudo-global variables
var attrArray = ["Russian Federation", "Ukraine", "Kazakhstan", "Poland", "Romania"]; //list of attributes
var expressed = attrArray[0]; //initial attribute

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = 460;
    
    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);
    
    //create Albers equal area conic projection centered on Europe
    var projection = d3.geoAlbers()
        .center([15.57, 49.91])
        .rotate([-20.48, 0.00, 0])
        .parallels([43.09, 25])
        .scale(650)
        .translate([width / 2, height / 2]);
    
    var path = d3.geoPath()
        .projection(projection);
    
    
    //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/EuropeMigrantData2015.csv") //load attributes from csv
        .defer(d3.json, "data/EuropeCountries.topojson") //load choropleth data
        .defer(d3.json, "data/WorldCountries.topojson") //load background data
        .await(callback);
    
    function callback(error, csvData, europe, worldCountries){
        
        //place graticule on the map
        setGraticule(map, path);
        
        //translate europe TopoJSON
        var europeCountries = topojson.feature(europe, europe.objects.EuropeCountries).features,
            worldBorders = topojson.feature(worldCountries, worldCountries.objects.WorldCountries);
        
        //add world countries
        var backgroundCountries = map.append("path")
            .datum(worldBorders)
            .attr("class", "countries")
            .attr("d", path);
        
        //join csv data to GeoJSON enumeration units
        europeCountries = joinData(europeCountries, csvData);
        
        //create the color scale
        var colorScale = makeColorScale(csvData);
        
        //add enumeration units to the map
        setEnumerationUnits(europeCountries, map, path, colorScale);
        
        //add coordinated visualization to the map
        setChart(csvData, colorScale);
    };
};
    
//function to create coordinated bar chart
function setChart(csvData, colorScale){
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.435,
        chartHeight = 460;
    
    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");
    
    //create a scale to size bars proportionally to frame
    var yScale = d3.scaleLinear()
        .range([0, chartHeight])
        .domain([0, 100000]);
    
    //set bars for each province
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return a[expressed]-b[expressed];
        })
        .attr("class", function(d){
            return "bars " + d.country;
        })
        .attr("width", chartWidth / csvData.length - 1)
        .attr("x", function(d, i){
            return i * (chartWidth / csvData.length);
        })
        .attr("height", function(d){
            return yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed]));
        })
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });
    
    //annotate bars with attribute value text
    var numbers = chart.selectAll(".numbers")
        .data(csvData)
        .enter()
        .append("text")
        .sort(function(a, b){
            return a[expressed]-b[expressed];
        })
        .attr("class", function(d){
            return "numbers " + d.country;
        })
        .attr("text-anchor", "middle")
        .attr("x", function(x, i){
            var fraction = chartWidth / csvData.length;
            return i * fraction + (fraction - 1) / 2;
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed])) + 15;
        })
        .text(function(d){
            return d[expressed];
        });
    
    //create a text element for chart title
    var chartTitle = chart.append("text")
        .attr("x", 20)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Number of People from " + expressed + " in each country");
};
    
function setGraticule(map, path){
    
    //create graticule generator
    var graticule = d3.geoGraticule()
            .step([10, 10]); //place graticule lines every 5 degrees lat and long
    
    //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assing class for styling
            .attr("d", path) //project graticule
        
    //create graticlue lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be covered
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assing class for styling
            .attr("d", path); //project graticule lines
    
};

function joinData(europeCountries, csvData){
    
    //loop through csv to assign each set of csv attribute values to geojson region
        for (var i=0; i<csvData.length; i++){
            var csvRegion = csvData[i]; //the current region
            console.log(csvRegion);
            var csvKey = csvRegion.CountryCode; //the csv primary key
            
            //loop through geojson regions to find correct region
            for (var a=0; a<europeCountries.length; a++){
                var geojsonProps = europeCountries[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.CC; //the geojson primary key
                
                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){
                    
                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvRegion[attr]); //get csv attribute values
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };
    
    return europeCountries;
};

function setEnumerationUnits(europeCountries, map, path, colorScale){
    
    //add Europe countries to map
        var countries = map.selectAll(".regions")
            .data(europeCountries)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "regions " + d.properties.sovereignt;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            });
};
    
//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#D4B9DA",
        "#C994C7",
        "#DF65B0",
        "#DD1C77",
        "#980043"
    ];
    
    //create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);
 
    //build array of all value of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };
    
    //assign array of expressed values as scale domain
    colorScale.domain(domainArray);
    
    return colorScale;
};
    
//function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};
})();