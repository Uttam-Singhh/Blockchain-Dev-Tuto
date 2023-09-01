const { network, ethers } = require("hardhat")
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { developmentChains } = require("../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Price Consumer Unit Tests", async function () {
        // We define a fixture to reuse the same setup in every test.
        // We use loadFixture to run this setup once, snapshot that state,
        // and reset Hardhat Network to that snapshot in every test.
        async function deployPriceConsumerFixture() {
            const [deployer] = await ethers.getSigners()

            const DECIMALS = "18"
            const INITIAL_PRICE = "200000000000000000000"

            const mockV3AggregatorFactory = await ethers.getContractFactory("MockV3Aggregator")
            const mockV3Aggregator = await mockV3AggregatorFactory
                .connect(deployer)
                .deploy(DECIMALS, INITIAL_PRICE)

            const tuneTokenizeV3Factory = await ethers.getContractFactory("TuneTokenize")
            const tuneTokenize = await tuneTokenizeV3Factory
                .connect(deployer)
                .deploy(mockV3Aggregator.address)

            return { tuneTokenize, mockV3Aggregator }
        }

        it("should have the correct name and symbol", async function () {
            const { tuneTokenize } = await loadFixture(
                deployPriceConsumerFixture
            )
            const name = await tuneTokenize.name()
            const symbol = await tuneTokenize.symbol()

            assert.equal(name, "Tune Tokenize")
            assert.equal(symbol, "TT")
        })

        describe("#getLatestPrice", async function () {
            describe("success", async function () {
                it("should return the same value as the mock", async () => {
                    const { tuneTokenize, mockV3Aggregator } = await loadFixture(
                        deployPriceConsumerFixture
                    )
                    const priceConsumerResult = await tuneTokenize.getLatestPrice()
                    const priceFeedResult = (await mockV3Aggregator.latestRoundData()).answer
                    assert.equal(priceConsumerResult.toString(), priceFeedResult.toString())
                })
            })
        })

        describe("mintToken function", () => {
            it("fails if there is no token URI", async function () {
                const { tuneTokenize } = await loadFixture(
                    deployPriceConsumerFixture
                )
                await expect(
                    tuneTokenize.mintToken("", {
                        value: ethers.utils.parseEther("1"), // sending 1 ETH
                    }),
                ).to.be.revertedWith("TuneTokenize__InvalidTokenUri")
            })
            it("reverts if payment amount is less than the dynamically calculated mint fee", async function () {
                const { tuneTokenize } = await loadFixture(
                    deployPriceConsumerFixture
                )
                const mintPrice = await tuneTokenize.getMintPriceETH()
                await expect(
                    tuneTokenize.mintToken("tokenURI", {
                        value: mintPrice.sub(1), // sending less than required ETH
                    })
                ).to.be.revertedWith("TuneTokenize__NeedMoreETHSent")
            })

            it("increments the tokenId after minting a new token", async function () {
                const { tuneTokenize } = await loadFixture(
                    deployPriceConsumerFixture
                )
                const beforeTokenId = await tuneTokenize.getCurrentTokenId()
                await tuneTokenize.mintToken("tokenURI", {
                    value: ethers.utils.parseEther("1"), // sending 1 ETH
                })
                const afterTokenId = await tuneTokenize.getCurrentTokenId()
                expect(afterTokenId).to.equal(beforeTokenId + 1)
            })

            it("emits an event and sets the correct token URI and minter", async function () {
                const { tuneTokenize, } = await loadFixture(
                    deployPriceConsumerFixture
                )
                accounts = await ethers.getSigners()
                deployer = accounts[0]

                const tokenUri = "tokenURI"
                const mintTx = await tuneTokenize.mintToken(tokenUri, {
                    value: ethers.utils.parseEther("1"), // sending 1 ETH
                })
                expect(mintTx).to.emit(tuneTokenize, "Minted").withArgs(1, tokenUri)
                const receipt = await mintTx.wait()
                const event = receipt.events.find((e) => e.event === "Minted")
                const tokenId = event.args[1]
                const retrievedTokenUri = await tuneTokenize.tokenURI(tokenId)
                expect(retrievedTokenUri).to.equal(tokenUri)
                const minter = await tuneTokenize._minters(tokenId)
                expect(minter).to.equal(deployer.address)
            })
        })
        describe("burn function", () => {
            it("does not allow a non-approved address (ie minter if they are still owner) to burn the token", async function () {
                const { tuneTokenize, } = await loadFixture(
                    deployPriceConsumerFixture
                )
                await tuneTokenize.mintToken("tokenURI", {
                    value: ethers.utils.parseEther("1"), // sending 1 ETH
                })
                const currentTokenId = await tuneTokenize.getCurrentTokenId()
                const tokenId = currentTokenId.sub(1) // Get the most recently minted token
                await expect(tuneTokenize.connect(accounts[1]).burn(tokenId)).to.be.revertedWith(
                    "TuneTokenize__CanOnlyBeBurnedIfOwnedByMinter"
                )
            })
            it("burns the token successfully, reducing owner's balance", async function () {

                // Mint a new token
                const { tuneTokenize, } = await loadFixture(
                    deployPriceConsumerFixture
                )
                await tuneTokenize.mintToken("tokenURI", {
                    value: ethers.utils.parseEther("1"), // sending 1 ETH
                })
                const initialOwnerBalance = await tuneTokenize.balanceOf(deployer.address)
                const tokenIdToBurn = (await tuneTokenize.getCurrentTokenId()).toNumber() - 1
                await tuneTokenize.burn(tokenIdToBurn)
                const finalOwnerBalance = await tuneTokenize.balanceOf(deployer.address)
                expect(finalOwnerBalance).to.equal(initialOwnerBalance - 1)
            })
        })

        describe("withdraw function", () => {
                    it("reverts if there is no balance to withdraw", async function () {
                        await expect(tuneTokenize.withdraw()).to.be.revertedWith("TuneTokenize__NothingToWithdraw")
                    })
                    it("transfers the contract's balance to the owner", async function () {
                        const { tuneTokenize, } = await loadFixture(
                            deployPriceConsumerFixture
                        )
                        await tuneTokenize.mintToken("tokenURI", {
                            value: ethers.utils.parseEther("1"), // sending 1 ETH
                        })
                        const initialBalance = await ethers.provider.getBalance(deployer.address)
                        await tuneTokenize.connect(deployer).withdraw()
                        const finalBalance = await ethers.provider.getBalance(deployer.address)
                        expect(finalBalance).to.be.gt(initialBalance)
                    })
                })
    })