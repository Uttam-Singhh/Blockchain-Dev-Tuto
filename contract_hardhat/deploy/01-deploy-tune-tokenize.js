const { network } = require("hardhat")
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy,log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    mockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator")

    const priceFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306" // replace with price feed address
    const tuneTokenize = await deploy("TuneTokenize", {
        from: deployer,
        args: [priceFeedAddress],
        log: true,
    })

    console.log("TuneTokenize deployed to:", tuneTokenize.address)
}

module.exports.tags = ["TuneTokenize", "all"]