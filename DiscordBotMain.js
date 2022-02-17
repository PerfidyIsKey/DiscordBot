const Discord = require('discord.js');
const { resolve } = require('path');
const client = new Discord.Client();

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb+srv://Perfidy:rhHfMOdWC1T9uCB1@discordbot.mjhf6.gcp.mongodb.net/DiscordBots?retryWrites=true&w=majority"

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

let db
let dbo
let prefix = "+"
let message

function addPrefix(command) {
    return prefix + command
}

function roundAmount(credits) {
    credits = Math.round(+credits)
    if (credits < 0) {
        return -credits
    }
    return credits
}

function IDExtractor(user) {
    let userID = user.replace("<", "")
    userID = userID.replace(">", "")
    userID = userID.replace("@", "")
    userID = userID.replace("!", "")
    return userID
}

function IDEncaser(id) {
    let user = "<@" + id + ">"
    return user
}

function roulette(msg, arguments) {

    if (arguments[1] == "help") {
        rouletteHelp(msg, arguments)
    } else {
        let wager = roundAmount(arguments[2])

        const creditCheckPromise = new Promise((resolve, reject) => {
            checkCredits(msg.author.id, wager, resolve, reject)
        })

        creditCheckPromise.then(() => {
            let roll = [-1, 0]
            if (arguments[3]) {
                roll[0] = +arguments[3]
                if (arguments[4]) {
                    roll[1] = +arguments[4]
                }
            }

            const roulettePromise = new Promise((resolve, reject) => {
                rouletteValidation(resolve, reject, arguments[1], roll)
            })

            roulettePromise.then(() => {
                let finalRoll = doRoulette()
                let multiplier = checkRoulette(arguments[1], roll, finalRoll)

                if (multiplier != 0) {
                    let amount = wager * multiplier
                    const innerRoulettePromise = new Promise((resolve, reject) => {
                        updateCredits(msg.author.id, amount, resolve, reject)
                    })

                    innerRoulettePromise.then(() => {
                        msg.reply("You rolled a **" + finalRoll + " " + rouletteCheckColor(finalRoll) + "**!\n You won **" + amount + "** credits!")
                    })

                    innerRoulettePromise.catch(() => {
                        msg.reply("Something went wrong trying to add your **" + amount + "** credits :(")
                    })
                } else {
                    const innerRoulettePromise = new Promise((resolve, reject) => {
                        updateCredits(msg.author.id, -wager, resolve, reject)
                    })

                    innerRoulettePromise.then(() => {
                        msg.reply("You rolled a **" + finalRoll + " " + rouletteCheckColor(finalRoll) + "**!\n You lost **" + wager + "** credits!")
                        addToJackpot(wager)
                    })

                    innerRoulettePromise.catch(() => {
                        msg.reply("Something went wrong when trying to take your **" + wager + "** credits >:3")
                    })
                }
            })

            roulettePromise.catch(() => {
                msg.reply("This is not a valid roulette roll.")
                db.close()
            })

        })

        creditCheckPromise.catch(() => {
            msg.reply("You don't have enough money to do this roulette roll.")
        })
    }
}

function rouletteHelp(msg, arguments) {
    let response = new Discord.MessageEmbed()
    response.setTitle("Roulette Help")

    if (arguments[2] && arguments[2] == "board") {
        rouletteBoard(msg)
    } else {
        response.addFields(
            { name: "help board", value: addPrefix("roulette help board") + "\n This displays the board." },
            { name: "number", value: addPrefix("roulette number <wager> <num>") },
            { name: 'split', value: addPrefix("roulette split <wager> <num1> <num2>") + "\n A split is always on 2 numbers next to each other on the board. (num1 should always be lower than num2)" },
            { name: 'street', value: addPrefix("roulette street <wager> <num>") + "\n A street is 3 numbers next to each other horizontally. (The input expects the most left number)" },
            { name: 'corner', value: addPrefix("roulette corner <wager> <num>") + "\n A corner is the corner of 4 numbers on the board. (The input expects the top-left number)" },
            { name: 'basket', value: addPrefix("roulette basket <wager> <num>") + "\n A basket is either 0 + 1 + 2 or 0 + 2 + 3. You can pick these by using 1 and 2 respectively." },
            { name: 'sixline', value: addPrefix("roulette sixline <wager> <num>") + "\n A sixline is a double street. (The input expects the top-left number)" },
            { name: 'column', value: addPrefix("roulette street <wager> <num>") + "\n A column is an entire vertical line. (The input expects the top number)" },
            { name: 'dozen', value: addPrefix("roulette street <wager> <num>") + "\n A dozen is a double sixline. (The input expects the top-left number)" },
            { name: 'odd', value: addPrefix("roulette odd <wager>") },
            { name: 'even', value: addPrefix("roulette even <wager>") },
            { name: 'red', value: addPrefix("roulette red <wager>") },
            { name: 'black', value: addPrefix("roulette black <wager>") },
            { name: 'low', value: addPrefix("roulette low <wager>") + "\n low means everything under 19. (0 is the exception)" },
            { name: 'high', value: addPrefix("roulette high <wager>") + "\n high means everything above 18." },
        )

        msg.reply(response)
    }
}

function rouletteBoard(msg) {

    let response = new Discord.MessageEmbed()
    response.setTitle("RouletteBoard")

    let values = ["", "", ""]

    for (let i = 1; i < 37; i++) {
        if (i % 3 == 1) {
            values[0] += i + " " + rouletteCheckColor(i) + "\n"
        }
        else if (i % 3 == 2) {
            values[1] += i + " " + rouletteCheckColor(i) + "\n"
        }
        else if (i % 3 == 0) {
            values[2] += i + " " + rouletteCheckColor(i) + "\n"
        } else {

        }
    }
    response.addFields(
        { name: '-', value: values[0], inline: true },
        { name: '0 green', value: values[1], inline: true },
        { name: '-', value: values[2], inline: true }
    )

    msg.reply(response)
}

function rouletteCheckColor(roll) {
    if (roll == 0) {
        return "green"
    } else {
        let red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
        let color = "black"
        for (num of red) {
            if (roll == num) {
                color = "red"
                break
            }
        }
        return color
    }
}

function rouletteValidation(resolve, reject, type, chosenRoll) {
    if (type == "number" && ((chosenRoll[0] * 0) == 0 && chosenRoll[0] <= 36 && chosenRoll[0] >= 0) || chosenRoll[0] == 0) {
        resolve()
    } else if (type == "split" && ((chosenRoll[0] + 1) == chosenRoll[1] || (chosenRoll[0] + 3) == chosenRoll[1]) && chosenRoll[0] <= 36 && chosenRoll[0] >= 0) {
        resolve()
    } else if (type == "street" && ((chosenRoll[0] % 3) == 1) && chosenRoll[0] <= 36 && chosenRoll[0] >= 0) {
        resolve()
    } else if (type == "corner" && chosenRoll[0] <= 32 && chosenRoll[0] % 3 != 0 && chosenRoll[0] >= 0) {
        resolve()
    } else if (type == "basket" && (chosenRoll[0] == 1 || chosenRoll[0] == 2)) {
        resolve()
    } else if (type == "sixline" && chosenRoll[0] <= 31 && chosenRoll[0] % 3 == 1 && chosenRoll[0] >= 0) {
        resolve()
    } else if (type == "column" && chosenRoll[0] >= 1 && chosenRoll[0] <= 3) {
        resolve()
    } else if (type == "dozen" && (chosenRoll[0] == 1 || chosenRoll[0] == 13 || chosenRoll[0] == 25)) {
        resolve()
    } else if (type == "odd" || type == "even") {
        resolve()
    } else if (type == "red" || type == "black") {
        resolve()
    } else if (type == "low" || type == "high") {
        resolve()
    } else {
        reject()
    }
}

function doRoulette() {
    let random = Math.round(Math.random() * 36)
    return random
}

function checkRoulette(type, chosenRoll, roll) {
    if (type == "number") {
        return rouletteNumber(chosenRoll, roll)
    } else if (type == "split") {
        return rouletteSplit(chosenRoll, roll)
    } else if (type == "street") {
        return rouletteStreet(chosenRoll, roll)
    } else if (type == "corner") {
        return rouletteCorner(chosenRoll, roll)
    } else if (type == "basket") {
        return rouletteBasket(chosenRoll, roll)
    } else if (type == "sixline") {
        return rouletteSixLine(chosenRoll, roll)
    } else if (type == "column") {
        return rouletteColumn(chosenRoll, roll)
    } else if (type == "dozen") {
        return rouletteDozen(chosenRoll, roll)
    } else if (type == "odd" || type == "even") {
        return rouletteOE(type, roll)
    } else if (type == "red" || type == "black") {
        return rouletteRB(type, roll)
    } else if (type == "low" || type == "high") {
        return rouletteLH(type, roll)
    } else {
        return 1
    }
}

function rouletteNumber(chosenRoll, roll) {
    if (chosenRoll[0] == roll) {
        return 35
    } else {
        return 0
    }
}

function rouletteSplit(chosenRoll, roll) {
    if (chosenRoll[0] == roll || chosenRoll[1] == roll) {
        return 17
    } else {
        return 0
    }
}

function rouletteStreet(chosenRoll, roll) {
    if (roll <= (chosenRoll[0] + 2) && chosenRoll[0] <= roll) {
        return 11
    } else {
        return 0
    }
}

function rouletteCorner(chosenRoll, roll) {
    if (chosenRoll[0] == roll || (chosenRoll[0] + 1) == roll || (chosenRoll[0] + 3) == roll || (chosenRoll[0] + 4) == roll) {
        return 8
    } else {
        return 0
    }
}

function rouletteBasket(chosenRoll, roll) {
    if (roll == 0 || roll == 2 || (chosenRoll[0] == 2 && roll == 3) || chosenRoll[0] == roll) {
        return 8
    } else {
        return 0
    }
}

function rouletteSixLine(chosenRoll, roll) {
    if (roll <= (chosenRoll[0] + 5) && chosenRoll[0] <= roll) {
        return 5
    } else {
        return 0
    }
}

function rouletteColumn(chosenRoll, roll) {
    let remainder = roll % 3
    if (chosenRoll[0] == remainder || (chosenRoll[0] == 3 && remainder == 0)) {
        return 2
    } else {
        return 0
    }
}

function rouletteDozen(chosenRoll, roll) {
    if (roll <= (chosenRoll[0] + 11) && chosenRoll[0] <= roll) {
        return 2
    } else {
        return 0
    }
}

function rouletteOE(type, roll) {
    let remainder = roll % 2
    if ((type == "odd" && remainder == 1) || (type == "even" && remainder == 0)) {
        return 1
    } else {
        return 0
    }
}

function rouletteRB(type, roll) {
    let color = rouletteCheckColor(roll)

    if ((color == type) && roll != 0) {
        return 1
    } else {
        return 0
    }
}

function rouletteLH(type, roll) {
    if ((type == "low" && roll <= 18) || (type == "high" && roll >= 19)) {
        return 1
    } else {
        return 0
    }
}

function addToJackpot(amount) {
    amount = roundAmount(amount)

    const addToJackpotPromise = new Promise((resolve, reject) => {
        updateCredits("<bot>", amount, resolve, reject)
    })

    addToJackpotPromise.then(() => {

    })

    addToJackpotPromise.catch(() => {

    })
}

function jackpotAmount(outerResolve, outerReject) {
    let query = { id: "<bot>" };

    const creditCheckPromise = new Promise((resolve, reject) => {
        getFromDatabase(resolve, reject, query)
    })

    creditCheckPromise.then((result) => {
        if (result[0].credits < 0) {
            outerReject()
        } else {
            outerResolve(result[0].credits)
        }
    })

    creditCheckPromise.catch(() => {
        outerReject()
    })
}

function jackpotRoll(msg, amount, outerResolve, outerReject) {
    const jackpotRollPromise = new Promise((resolve, reject) => {
        let random = Math.round(Math.random() * 10000)
        if (random == 666) {
            jackpotAmount(resolve, reject)
        } else {
            addToJackpot(amount)
            updateCredits(msg.author.id, -amount, reject, reject)
        }
    })

    jackpotRollPromise.then((jackpotCredits) => {
        const innerJackpotPromise = new Promise((innerResolve, innerReject) => {
            let arguments = ["", msg.author.id, jackpotCredits]
            giveMoney("<bot>", arguments, innerResolve, innerReject)
        })

        innerJackpotPromise.then(() => {
            outerResolve(jackpotCredits)
        })

        innerJackpotPromise.catch(() => {
            outerReject()
        })

    })

    jackpotRollPromise.catch(() => {
        outerReject()
    })
}

function jackpot(msg, jackpotBetAmount, outerResolve, outerReject) {

    const jackpotPromise = new Promise((resolve, reject) => {
        checkCredits(msg.author.id, jackpotBetAmount, resolve, reject)
    })

    jackpotPromise.then(() => {
        jackpotRoll(msg, jackpotBetAmount, outerResolve, outerReject)
    })

    jackpotPromise.catch(() => {
        outerReject("You don't have enough credits to roll")
    })
}

function giveMoney(id, arguments, outerResolve, outerReject) {
    let user = arguments[1]
    let amount = arguments[2]
    amount = roundAmount(amount)

    const giveMoneyPromise = new Promise((resolve, reject) => {
        checkCredits(id, amount, resolve, reject)
    })

    giveMoneyPromise.then(() => {
        const innerGiveMoneyPromise = new Promise((innerResolve, innerReject) => {
            updateCredits(id, (amount * -1), innerResolve, innerReject)
        })

        innerGiveMoneyPromise.then(() => {
            updateCredits(IDExtractor(user), amount, outerResolve, outerReject)
        })

        innerGiveMoneyPromise.catch(() => {
            outerReject()
        })
    })

    giveMoneyPromise.catch(() => {
        outerReject()
    })
}

function checkCredits(userID, amount, outerResolve, outerReject) {
    let query = { id: userID };

    const creditCheckPromise = new Promise((resolve, reject) => {
        getFromDatabase(resolve, reject, query)
    })

    creditCheckPromise.then((result) => {
        if (!result[0].credits || !(+(result[0].credits) >= +amount && +amount > 0)) {
            outerReject()
        } else {
            outerResolve()
        }
    })

    creditCheckPromise.catch(() => {
        outerReject()
    })

}

function updateCredits(userID, amount, outerResolve, outerReject) {
    let query = { id: userID };
    const creditUpdatePromise = new Promise((resolve, reject) => {
        getFromDatabase(resolve, reject, query)
    })
    creditUpdatePromise.then((result) => {
        let credits = result[0].credits
        if (!credits && credits != 0) {
            outerReject()
        } else {
            let newvalues = { $set: { credits: (credits + amount) } };
            updateDatabase(outerResolve, outerReject, query, newvalues)
        }
    })

    creditUpdatePromise.catch(() => {
        outerReject()
    })
}

function duelWin(winnerID, loserID, amount, msg, outerResolve, outerReject) {
    const duelWinPromise = new Promise((resolve, reject) => {
        updateCredits(winnerID, amount, resolve, reject)
    })

    duelWinPromise.then(() => {
        msg.channel.send(IDEncaser(winnerID) + ", You won **" + amount + "** credits from " + IDEncaser(loserID) + "!")
        updateCredits(loserID, (amount * -1), outerResolve, outerReject)
    })

    duelWinPromise.catch(() => {
        outerReject()
    })
}

function performDuel(ID, duelID, amount, msg) {
    let rn = Math.round(Math.random())
    const duelPromise = new Promise((resolve, reject) => {
        if (rn == 0) {
            duelWin(ID, duelID, amount, msg, resolve, reject)
        } else {
            duelWin(duelID, ID, amount, msg, resolve, reject)
        }
    })

    duelPromise.then(() => {

    })

    duelPromise.catch(() => {
        msg.reply("Something went wrong when performing duel.")
    })

}

function duelAccept(msg, duelistID, outerResolve, outerReject) {
    let query = { id: duelistID };
    let duelTimeOut = 1000 * 60 * 5

    const duelAcceptPromise = new Promise((resolve, reject) => {
        getFromDatabase(resolve, reject, query)
    })

    duelAcceptPromise.then((result) => {
        if (!result[0].duelPartner || !result[0].duelTime) {
            outerReject()
        } else {
            if (result[0].duelPartner == msg.author.id) {
                let now = Date.now()
                if (+now - +(result[0].duelTime) < duelTimeOut) {
                    outerResolve(result)
                } else {
                    outerReject()
                }
            } else {
                outerReject()
            }
        }
    })

    duelAcceptPromise.catch(() => {
        outerReject()
    })
}

function duelRequest(msg, player, duel, amount) {
    if (duel) {
        let time = Date.now()
        newvalues = { $set: { duelPartner: IDExtractor(player), duelTime: time, duelAmount: amount } };
        let query = { id: msg.author.id };

        const duelRequestPromise = new Promise((resolve, reject) => {
            updateDatabase(resolve, reject, query, newvalues)
        })

        duelRequestPromise.then(() => {
            msg.channel.send(player + ", do you accept this challenge?\n Type: " + addPrefix("duel accept " + IDEncaser(msg.author.id)))
            db.close()
        })

        duelRequestPromise.catch(() => {
            msg.reply("The duel could not be requested.")
            db.close()
        })

    } else {
        msg.reply("The duel could not be requested. Check if you both have enough credits.")
        db.close()
    }
}

function duel(msg, arguments) {

    if (arguments[1] === "accept") {
        let user = arguments[2]
        const duelAcceptPromise = new Promise((resolve, reject) => {
            duelAccept(msg, IDExtractor(user), resolve, reject)
        })

        duelAcceptPromise.then((result) => {
            performDuel(msg.author.id, IDExtractor(user), result[0].duelAmount, msg)
        })

        duelAcceptPromise.catch(() => {
            db.close()
        })


    } else {
        let player = arguments[1]
        let amount = arguments[2]

        let playerID = IDExtractor(player)
        let userID = msg.author.id
        if (userID != playerID) {
            amount = roundAmount(amount)
            const duelPromise = new Promise((resolve, reject) => {
                checkCredits(playerID, amount, resolve, reject)
            })

            duelPromise.then(() => {
                const innerPromise = new Promise((resolve, reject) => {
                    checkCredits(userID, amount, resolve, reject)
                })

                innerPromise.then(() => {
                    duelRequest(msg, player, true, amount)
                })

                innerPromise.catch(() => {
                    duelRequest(msg, player, false, amount)
                })
            })

            duelPromise.catch(() => {
                duelRequest(msg, player, false, amount)
            })
        }
    }
}

function addDaily(msg, result, todayDate, query) {
    let newCredits = 0

    let streakVal = result[0].dailyStreak

    let streakTimeout = 60 * 60 * 40 * 1000

    let oldDate = result[0].dailyDate

    if (!streakVal || (+todayDate - +oldDate) > streakTimeout) {
        streakVal = 0
    }
    let dailyAmount = 200 + (200 * +streakVal)
    dailyAmount = roundAmount(dailyAmount)
    streakVal += 0.1
    newCredits = +(result[0].credits) + dailyAmount

    newvalues = { $set: { credits: newCredits, dailyDate: todayDate, dailyStreak: streakVal } };

    const addDailyPromise = new Promise((resolve, reject) => {
        updateDatabase(resolve, reject, query, newvalues)
    })

    addDailyPromise.then(() => {
        msg.reply("You have received **" + dailyAmount + "** credits! Your current streak is **" + Math.round(streakVal * 10) + "**.")
        db.close();
    })

    addDailyPromise.catch(() => {
        msg.reply("Something went wrong handing out daily.")
        db.close();
    })


}

function dailyCredits(msg) {
    let query = { id: msg.author.id };

    let todayDate = new Date()

    const dailyPromise = new Promise((resolve, reject) => {
        getFromDatabase(resolve, reject, query)
    })

    dailyPromise.then((result) => {
        if (!result[0].dailyDate) {
            addDaily(msg, result, todayDate, query)
        } else {
            let oldDate = result[0].dailyDate

            let dailyTime = 60 * 60 * 14 * 1000

            if ((+todayDate - +oldDate) > dailyTime) {
                addDaily(msg, result, todayDate, query)
            } else {
                msg.reply("Your daily has already been claimed :(")
                db.close();
            }
        }
    })

    dailyPromise.catch(() => {
        const newUserPromise = new Promise((resolve, reject) => {
            createNewUser(msg, resolve, reject)
        })

        newUserPromise.then(() => {
            console.log("New user created")
        })

        newUserPromise.catch(() => {
            db.close()
        })
    })
}

function doCoinFlip(result, amount, heads, msg, query) {
    let win = false
    let userCredits = result[0].credits
    if (amount == "all") {
        amount = userCredits
    } else {
        amount = roundAmount(amount)
    }

    if (amount <= userCredits && amount > 0) {
        let rn = Math.round(Math.random())
        if (rn == 0 && heads || rn == 1 && !heads) {
            win = true
        }

        let ht
        if (heads) {
            ht = "heads"
        } else {
            ht = "tails"
        }

        var newvalues = {}
        let credRes = userCredits
        if (win) {
            credRes += +amount

            msg.reply('Congratulations!! You chose **' + ht + '** and received **' + amount + '** credits!');
        } else {
            credRes -= +amount

            msg.reply('Better luck next time! You chose **' + ht + '** and lost **' + amount + '** credits!');
            addToJackpot(amount)
        }

        newvalues = { $set: { credits: credRes } };

        const coinFlipPromise = new Promise((resolve, reject) => {
            updateDatabase(resolve, reject, query, newvalues)
        })

        coinFlipPromise.then(() => {
            db.close();
        })

        coinFlipPromise.catch(() => {
            msg.reply("The coin landed on the side!!");
            db.close();
        })
    }
    else {
        msg.reply("You don't have sufficient credits.");
    }
}

function createNewUser(msg, outerResolve, outerReject) {

    let date = new Date()
    var myobj = { name: msg.author.username, id: msg.author.id, credits: 200, dailyDate: date };

    const newUserPromise = new Promise((resolve, reject) => {
        insertToDatabase(resolve, reject, myobj)
    })

    newUserPromise.then(() => {
        console.log("1 document inserted.")
        messageHandler(msg)
        outerResolve()
    })

    newUserPromise.catch(() => {
        console.log("something went wrong inserting user by msg")
        outerReject()
    })
}

function createNewUserByID(msg, userID) {

    let date = new Date()
    var myobj = { id: userID, credits: 200, dailyDate: date };

    const newUserPromise = new Promise((resolve, reject) => {
        insertToDatabase(resolve, reject, myobj)
    })

    newUserPromise.then(() => {
        console.log("1 document inserted.")
        messageHandler(msg)
    })

    newUserPromise.catch(() => {
        console.log("something went wrong inserting user by id")
        db.close()
    })
}

function insertToDatabase(resolve, reject, object) {
    dbo.collection("DiscordBot1").insertOne(object, function (err, result) {
        if (err) {
            reject()
        } else {
            resolve(result)
        }
    })
}

function getFromDatabase(outerResolve, outerReject, query) {
    dbo.collection("DiscordBot1").find(query).toArray(function (err, result) {
        if (err) {
            outerReject()
        }
        if (!result || !result[0]) {

            createNewUser(message, outerResolve, outerReject)

        } else {
            outerResolve(result)
        }
    })
}

function updateDatabase(resolve, reject, query, newvalues) {
    dbo.collection("DiscordBot1").updateOne(query, newvalues, function (err, result) {
        if (err) {
            reject()
        } else {
            resolve(result)
        }
    });
}

function coinFlip(msg, heads, amount) {
    let query = { id: msg.author.id };
    const dbPromise = new Promise((resolve, reject) => {
        getFromDatabase(resolve, reject, query)
    });

    dbPromise.then((result) => {
        doCoinFlip(result, amount, heads, msg, query)
    });

    dbPromise.catch(() => {
        const newUserPromise = new Promise((resolve, reject) => {
            createNewUser(message, resolve, reject)
        })

        newUserPromise.then(() => {
            console.log("New user created")
        })

        newUserPromise.catch(() => {
            db.close()
        })
    })
}

function messageHandler(msg) {
    const jackpotBetAmount = 1000

    message = msg
    dbo = db.db("DiscordBots");

    let arguments = msg.content.split(" ")
    let command = arguments[0].replace(prefix, "")

    if (command == "heads") {
        coinFlip(msg, true, arguments[1])
    }
    else if (command == "tails") {
        coinFlip(msg, false, arguments[1])
    }
    else if (command == "credits") {
        let userID = ""
        let user = ""
        if (arguments[1]) {
            userID = IDExtractor(arguments[1])
            user = arguments[1]
        } else {
            userID = msg.author.id
            user = IDEncaser(userID)
        }

        let query = { id: userID };

        const creditPromise = new Promise((resolve, reject) => {
            getFromDatabase(resolve, reject, query)
        })

        creditPromise.then((result) => {
            msg.channel.send(user + ", currently has **" + result[0].credits + "** credits.")
            db.close()
        })

        creditPromise.catch(() => {
            createNewUserByID(msg, userID)
        })

    } else if (command == "give") {
        const givePromise = new Promise((resolve, reject) => {
            giveMoney(msg.author.id, arguments, resolve, reject)
        })

        givePromise.then(() => {
            let user = arguments[1]
            let amount = arguments[2]
            msg.reply("You gave **" + amount + "** credits to " + user + "!")
        })

        givePromise.catch(() => {
            msg.reply("Something went wrong trying to give money :(")
        })


    } else if (command == "jackpot") {
        if (arguments[1] == "roll") {
            const jackpotPromise = new Promise((resolve, reject) => {
                jackpot(msg, jackpotBetAmount, resolve, reject)
            })

            jackpotPromise.then((creditsWon) => {
                msg.reply("You have won the jackpot and **" + creditsWon + "** credits have been added to your acount!")
                db.close()
            })

            jackpotPromise.catch((responseMessage) => {
                if (!responseMessage) {
                    msg.reply("You did not win the jackpot and lost **" + jackpotBetAmount + "** credits...")
                } else {
                    msg.reply(responseMessage)
                }
                db.close()
            })
        } else {
            const jackpotPromise = new Promise((resolve, reject) => {
                jackpotAmount(resolve, reject)
            })

            jackpotPromise.then((credits) => {
                msg.reply("The jackpot is **" + credits + "** credits!")
                db.close()
            })

            jackpotPromise.catch(() => {
                console.log("jackpot check went wrong.")
                db.close()
            })

        }

    } else if (command == "roulette") {
        roulette(msg, arguments)
    } else if (command == "help") {
        help(msg, jackpotBetAmount)
        db.close()
    } else if (command == "daily") {
        dailyCredits(msg)
    } else if (command == "duel") {
        duel(msg, arguments)
    }
    else {
        db.close()
    }
}

function help(msg, jackpotBetAmount) {
    let response = new Discord.MessageEmbed()
    response.setTitle("Help")
    response.addFields(
        { name: addPrefix("heads <credits>"), value: "50-50" },
        { name: addPrefix("tails <credits>"), value: "50-50" },
        { name: addPrefix("credits [@user]"), value: "Check the credits of yourself or another user." },
        { name: addPrefix("daily"), value: "Get your daily bit of cash, don't forget to keep your streak! (Streak is broken after 40 hours)" },
        { name: addPrefix("duel @user <credits>"), value: "Duel another user so you can take their cash or have your cash taken by them." },
        { name: addPrefix("give @user <credits>"), value: "Give another user some of your credits. (Because you're nice like that)" },
        { name: addPrefix("jackpot <roll>"), value: "Rolling the jackpot currently costs **" + jackpotBetAmount + "** credits. \n Do **" + addPrefix("jackpot") + "** to see the current prize." },
        { name: addPrefix("roulette help"), value: "This opens a help menu for roulette." },
    )
    msg.reply(response)
}

client.on('message', msg => {
    if (msg.content.startsWith(prefix)) {
        MongoClient.connect(url, function (err, database) {
            if (err) {

            } else {

                db = database
                messageHandler(msg)
            }
        })
    } else {

    }
});

client.on('error', (error) => console.log("Client Error: " + error));

let token = "NjgyMjI3NDUxODY2NTEzNDY1.XlZ70w.IbUKIvEUgV1Tda_9_gFQLdMGLu8"

client.login(token);