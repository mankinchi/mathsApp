const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const router = require("express").Router();
const { User, Session, Response } = require("../models");
const withAuth = require("../utils/auth");

const {
  generateProblems,
  generateSteps,
  generateWolframProblems,
} = require("../utils/openAi");
const { fetchSolution } = require("../utils/wolfram");
const { request } = require("http");

// create a new set of problems based on the users inputs, return the array of problems and save the wolfram version to the db
router.post("/create", withAuth, async (req, res) => {
  try {
    console.log(
      typeof req.body.amountOfProblems,
      "<--------------------------------"
    );

    if (req.body.include.includes("@")) {
      req.body.include = "";
    }
    const problems = await generateProblems(
      req.body.area,
      req.body.include,
      req.body.amountOfProblems,
      req.body.difficulty,
      req.body.isWorded
    );
    // console.log(problems, "problems 28 dr");

    const problemsArray = problems.resultsHuman.split("@");
    const wolframProblems = await generateWolframProblems(
      problems.resultsHuman
    );
    // console.log(wolframProblems, "wolframProblems 34 dr");
    const wolframProblemsArray = wolframProblems.split("@");

    let problemsArrayTrimmed = [];
    let problemsArrayWolframTrimmed = [];
    const respArrObjs = [];
    for (const problem of problemsArray) {
      problemsArrayTrimmed.push(problem.trim());
    }
    for (const problem of wolframProblemsArray) {
      problemsArrayWolframTrimmed.push(problem.trim());
    }
    // console.log(problemsArrayWolframTrimmed, "DR 46");
    for (let i = 0; i < problemsArray.length; i++) {
      respArrObjs.push({
        question: problemsArrayTrimmed[i],
        wolframFormatQuestion: problemsArrayWolframTrimmed[i],
      });
    }
    const responses = await Response.insertMany(respArrObjs);
    const responsesIds = responses.map((resp) => resp._id);
    const session = await Session.create({
      area: req.body.area,
      include: req.body.include,
      worded: req.body.isWorded,
      amount: req.body.amountOfProblems,
      difficulty: req.body.difficulty,
      responses: responsesIds,
    });
    console.log(session, "================================");
    const updateUser = await User.findOneAndUpdate(
      { _id: req.session.user_id },
      {
        $push: {
          sessions: session._id,
        },
      },
      { new: true, rawResult: true }
    );
    console.log(updateUser);
    // console.log(responses, "responses 55 dr");

    res.status(200).json({
      problems: problemsArrayTrimmed,
    });
  } catch (err) {
    console.error(err);
    res.send(err);
  }
});

router.post("/solve", withAuth, async (req, res) => {
  //solve a question with wolfram, then generate a response with steps
  try {
    let solution = "";
    console.log(req.body.problem);
    let solutionFromWolfram = await fetchSolution(req.body.problem);
    console.log(await solutionFromWolfram, "line 70 dr");
    if ((await solutionFromWolfram.subpods.length) > 0) {
      for (const subpod of solutionFromWolfram.subpods) {
        if (solution === "") {
          solution = subpod.plaintext + ", ";
        } else {
          solution += subpod.plaintext + ", ";
        }
      }
      solution = solution.slice(0, -2);
    } else {
      solution = solutionFromWolfram.subpods.plaintext;
    }
    console.log(solution, "solution");
    res.status(200).json({ solution: solution });
  } catch (err) {
    console.error(err);
    res.send(err);
  }
});

module.exports = router;

// router.("/", async (req, res) => {
//     try {

//     } catch (err)
//      { console.error(err)
//         res.send(err)
//     }

// })
