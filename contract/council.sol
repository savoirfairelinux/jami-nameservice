/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Copyright (c) 2021 Savoir-faire Linux Inc.
 *
 * Author: Olivier Dion <olivier.dion@savoirfairelinux.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * urnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

pragma solidity >= 0.8.4;

import "store.sol";

struct Member {
        uint64 stake;
}

contract Council {

        mapping(address => Member) members;

        Proposal pending_proposal;

        Store[] public stores;

        address logic;
        bytes logic_abi;

        modifier if_member() {
                require(members[msg.sender].stake > 0,
                        "Function reserved to member.");
                _;
        }

        modifier if_from_valid_proposal() {

                require(address(pending_proposal) == msg.sender, "Invalid proposal.");

                require(block.timestamp < pending_proposal.valid_until() + 7 days,
                        "Proposal can't be executed after 7 days of its expiration date.");

                require(false == pending_proposal.executed(), "Proposal was already executed.");

                delete pending_proposal;
                pending_proposal = Proposal(address(0));

                _;
        }

        modifier if_no_pending_proposal() {
                require(address(0) == address(pending_proposal),
                        "There's a pending proposal.");
                _;
        }

        constructor() {

                members[msg.sender].stake = 0xFFFFFFFFFFFFFFFF;

                stores.push(new Store(address(this), logic));
        }

        function get_member(address addr) public view returns(Member memory) {
                return members[addr];
        }

        function get_logic() public view returns (address addr) {
                return address(logic);
        }

        function get_logic_abi() public view returns (bytes memory) {
                return logic_abi;
        }

        function make_store_proposal(uint24 valid_for) external if_member if_no_pending_proposal {
                pending_proposal = new StoreProposal(address(this), valid_for);
        }

        function new_store() external if_from_valid_proposal {
                stores.push(new Store(address(this), logic));
        }

        function make_logic_proposal(address new_logic, bytes memory new_abi, uint24 valid_for)
                external if_member if_no_pending_proposal {
                pending_proposal = new LogicProposal(address(this), valid_for, new_logic, new_abi);
        }

        function set_logic(address new_logic, bytes memory new_abi) public if_from_valid_proposal {

                logic     = new_logic;
                logic_abi = new_abi;

                for (uint i=0; i<stores.length; ++i) {
                        stores[i].set_logic(new_logic);
                }
        }

        function delegate_stake(address to, uint64 ammount) external if_member if_no_pending_proposal {

                require(address(0) != to &&
                        msg.sender != to, "Invalid recipient.");

                Member storage my = members[msg.sender];

                require(ammount <= my.stake);

                my.stake          -= ammount;
                members[to].stake += ammount;
        }
}

abstract contract Proposal {

        Council immutable council;
        uint256 public immutable valid_until;

        uint64 public is_for;
        uint64 public is_against;

        mapping(address => bool) voted;

        bool public executed;

        constructor(address of_council, uint24 valid_for) {

                require(valid_for >= 7 days, "Proposal lifetime is too short.");

                council     = Council(of_council);
                valid_until = block.timestamp + valid_for;
        }

        function vote(bool decision) private {

                /* Proposal is still valid? */
                require(block.timestamp < valid_until, "Proposal has expired.");

                Member memory member = council.get_member(msg.sender);

                /* Is member? */
                require(0 != member.stake, "Sender is not a member of council.");

                /* Address has not voted? */
                require(!voted[msg.sender], "Member has already voted.");

                /* Commit */
                voted[msg.sender] = true;

                if (decision) {
                        is_for += member.stake;
                } else {
                        is_against += member.stake;
                }
        }

        function vote_for() external {
                vote(true);
        }

        function vote_against() external {
                vote(false);
        }

        function terminate() external {

                require(block.timestamp >= valid_until, "Proposal is still in progress.");
                require(is_for + is_against >= 0xEFFFFFFFFFFFFFFF, "Not enough participation.");

                if (is_for > is_against) {
                        execute();
                }

                executed = true;

                selfdestruct(payable(address(council)));
        }

        function execute() virtual internal;
}

contract LogicProposal is Proposal {

        address logic;
        bytes  logic_abi;

        constructor(address of_council, uint24 valid_for, address new_logic, bytes memory new_abi) Proposal(of_council, valid_for) {
                logic     = new_logic;
                logic_abi = new_abi;
        }

        function execute() override internal {
                council.set_logic(logic, logic_abi);
        }
}

contract StoreProposal is Proposal {

        constructor(address of_council, uint24 valid_for) Proposal(of_council, valid_for) {

        }

        function execute() override internal {
                council.new_store();
        }
}
