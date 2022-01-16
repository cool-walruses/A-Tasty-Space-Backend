var express = require('express');
var router = express.Router();
const Database = require('../database.js');
const Recipe = require('../models/recipe.js');
const Constants = require('../constants.js').Constants;

const projectObj = {_id:1,name:1,time:1,difficulty:1,description:1,rating:1,image:1};

function deepcopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function excludeIfNull(key,value){
    return value === null ? null : {[key] : value};
}

function excludeIfEmpty(key,operator,values){
    return values.length === 0 ? null : {[key] : {[operator] : values}};
}

/**
 * Returns the query based on inputs. If an input is null, we want to ignore it
 * If all inputs are empty/null, we want to return ALL objects
 * 
 * @param {any} difficulty - the difficulty filter
 * @param {any} time - the time filter
 * @param {any} ingredients - the ingredients filter
 * @returns query
 */
function constructQuery(difficulty,time,ingredients) {
    var queryObj = { $and : [
        excludeIfNull('difficulty', difficulty),
        excludeIfNull('time', time),
        excludeIfEmpty("ingredients.ingredient",'$all', ingredients)
    ].filter(field => field !== null)}; //filter out empty/null
    
    //if its empty replace it with a query all - $and doesn't support empty list
    return queryObj.$and.length === 0 ? {} : queryObj; 
}

/**
 *  WHAT WE EXPECT TO GET FROM FE
 *  {
 *      difficulty : Number (0 - 2),
 *      time : Number (0 - 2),
 *      ingredients : Array of strings
 *  }
 * 
 *  If no filters are applied 
 *      difficulty : null
 *      number : null
 *      ingredients : []
 * 
 *  In the returned object, we want to stringify the ID for url purposes
 * 
 */
router.post('/search_view',  function(req,res,next){
    // Construct a query object
    // If a field is blank, we want to exclude that from the query
    // an all blank query should give us everything
    var queryObj = constructQuery(req.body.difficulty, req.body.time, req.body.ingredients);

    Database.get(Recipe,queryObj).select(projectObj)
        .then((result) => {
            if(result.length === 0) { 
                res.status(200).json([]);
            }
            else {
                let retarr = [];
                for (let obj of result){
                    let retobj = deepcopy(obj);
                    let id = retobj._id.toString();
                    delete retobj._id;
                    retobj.id = id;
                    console.log(retobj);
                    retarr.push(retobj);
                }
                retarr.sort(function(o1, o2) {
                    let o1_score = o1.rating[0] - o1.rating[1];
                    let o2_score = o2.rating[0] - o2.rating[1];
                    return o2_score - o1_score;
                });
                console.log(retarr);
                res.status(200).json(retarr);
            }  
        })
        .catch((err) => {
            res.status(500).json(err);
        });
});

router.get('/recipe/:recipeID', function(req,res,next){
    let recipeID = req.params.recipeID;
    Database.getById(Recipe, recipeID)
        .then((result) => {
            if(result === null) {
                res.status(404);
            }
            else {
                let retobj = deepcopy(result);
                let id = retobj._id.toString();
                delete retobj._id;
                retobj.id = id;
                console.log(retobj);
                res.status(200).json(retobj);
            }
        })
        .catch((err) => {
            res.status(500).json(err);
        });
});

router.get('/constants', function(req,res,next) {
    res.status(200).json({
        difficulty: Constants.difficulties,
        time: Constants.times,
        ingredients: Constants.ingredients
    });
});

router.post('/upvote/recipe/:recipeID', function(req, res, next) {
    let recipeID = req.params.recipeID;
    Database.getById(Recipe, recipeID)
        .then((result) => {
            if(result === null) {
                res.status(404).send();
            }
            else {
                let upvotes = result.rating[0] + 1;
                let downvotes = result.rating[1];
                let updated_rating = [upvotes, downvotes];
                Database.updateOne(Recipe, {_id : recipeID}, {rating: updated_rating})
                    .then((result) => {
                        if(result.acknowledged && result.modifiedCount == 1) {
                            res.status(200).send("success!");
                        }
                        else {
                            res.status(404).send("oops!");
                        }
                });
            }
        })
        .catch((err) => {
            res.status(500).json(err);
        });
});

router.post('/downvote/recipe/:recipeID', function(req, res, next) {
    let recipeID = req.params.recipeID;
    Database.getById(Recipe, recipeID)
        .then((result) => {
            if(result === null) {
                res.status(404).send();
            }
            else {
                let upvotes = result.rating[0];
                let downvotes = result.rating[1] + 1;
                let updated_rating = [upvotes, downvotes];
                Database.updateOne(Recipe, {_id : recipeID}, {rating: updated_rating})
                    .then((result) => {
                        if(result.acknowledged && result.modifiedCount == 1) {
                            res.status(200).send("success!");
                        }
                        else {
                            res.status(404).send("oops");
                        }
                });
            }
        })
        .catch((err) => {
            res.status(500).json(err);
        });
});

module.exports = router;
