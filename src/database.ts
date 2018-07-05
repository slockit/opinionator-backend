import { Pool } from 'pg';

export default class Database {

    private dbPool: Pool;

    constructor(host: string, user: string, password: string, dbname: string, port: number = 5432) {
        // Prepare PGSQL connection pool
        this.dbPool = new Pool({
            user: user,
            host: host,
            database: dbname,
            password: password,
            port: port
        });
    }

    public async getAllVotes() : Promise<Vote[]> {
        const resultVotes: Vote[] = [];
        try {
            const qry: string = "SELECT id, poll_id, voted_for_proposal, timestamp, address, message FROM votes";
            const dbResultRows = await this.dbPool.query(qry);

            dbResultRows.rows.forEach(row => {
                 resultVotes.push({
                     voteId: row.id,
                     pollId: row.poll_id,
                     proposalId: row.voted_for_proposal,
                     timestamp: row.timestamp,
                     voterAddress: row.address,
                     message: row.message,
                     isValid: true
                 });
            });

        }
        catch(err) {
            throw "unable to query DB:"  + err;
        }
        return resultVotes;
    }

    public async getVotesForPoll(pollId: number) : Promise<Vote[]> {
        const resultVotes: Vote[] = [];
        try {
            const qry: string = "SELECT id, voted_for_proposal, timestamp, address, message FROM votes WHERE poll_id = $1";
            const dbResultRows = await this.dbPool.query(qry,[pollId]);

            dbResultRows.rows.forEach(row => {
                resultVotes.push({
                    voteId: row.id,
                    pollId: pollId,
                    proposalId: row.voted_for_proposal,
                    timestamp: row.timestamp,
                    voterAddress: row.address,
                    message: row.message,
                    isValid: true
                });
            });

        }
        catch(err) {
            throw "unable to query DB:"  + err;
        }
        return resultVotes;
    }

    public async getGasSumForAddress(address: string) : Promise<number> {
        let gasSum: number = 0;

        const qry: string = "SELECT SUM(gas) as gas FROM transactions WHERE tx_sender = $1";
        try {
            const dbResultRows = await this.dbPool.query(qry,[address.toLowerCase()]);
            if(dbResultRows.rowCount > 0) {
                gasSum = parseInt(dbResultRows.rows[0].gas);
            } else {
                gasSum = -1;
            }
        }
        catch(err) {
            throw "Unable to query database: " + err;
        }
        return gasSum;
    }

    public async checkVoteExists(pollId: number, address: string) :Promise<boolean> {
        const qry: string = "SELECT count(poll_id) as ct FROM votes WHERE address = $1 AND poll_id = $2";
        try {
            const dbResultRows = await this.dbPool.query(qry,[address.toLowerCase(),pollId]);
            return dbResultRows.rows[0].ct > 0;
        } catch(err) {
            throw "Unable to query database: " + err;
        }
    }

    public async createVote(pollId: number, proposalId: number, address: string, message: string) : Promise<void> {
        const qry: string = "INSERT INTO votes (poll_id, voted_for_proposal, address, message) VALUES ($1,$2, $3, $4)";
        try {
            await this.dbPool.query(qry,[pollId,proposalId,address.toLowerCase(),message]);
        } catch(err) {
            throw "Unable to query database: " + err;
        }
    }

    public async updateVote(pollId: number, proposalId: number, address: string, message: string, isValidVote: boolean) : Promise<void> {
        const qry: string = "UPDATE votes SET voted_for_proposal = $1, message = $2 WHERE poll_id = $3 AND address = $4";
        try {
            await this.dbPool.query(qry,[proposalId,message,pollId,address.toLowerCase()])
        } catch(err) {
            throw "Unable to query database: " + err;
        }
    }

    public async getTotalTrxGasForProposal(pollId: number, proposalId: number) : Promise<number> {
        const qry: string = "SELECT SUM(transactions.gas) as gas FROM transactions INNER JOIN votes ON votes.address = transactions.tx_sender AND votes.voted_for_proposal = $1 AND votes.poll_id = $2";
        try {
            const dbResultRows = await this.dbPool.query(qry, [proposalId,pollId]);
            if(dbResultRows.rowCount > 0) {
                return parseInt(dbResultRows.rows[0].gas);
            } else {
                return 0;
            }
        } catch (err) {
            throw "Unable to query database: " + err;
        }
    }

    public async getTotalDifficultyForProposal(pollId: number, proposalId: number) : Promise<number> {
        const qry: string = "SELECT SUM(difficulty) as difficulty FROM block INNER JOIN votes ON votes.address = block.miner AND votes.voted_for_proposal = $1 AND votes.poll_id = $2 GROUP BY block.miner";
        try {
            const dbResultRows = await this.dbPool.query(qry, [proposalId,pollId]);
            if(dbResultRows.rowCount > 0) {
                return parseInt(dbResultRows.rows[0].difficulty);
            } else {
                return 0;
            }
        } catch (err) {
            throw "Unable to query database: " + err;
        }
    }

    public async getTotalContractGasForProposal(pollId: number, proposalId: number) : Promise<number> {
        // TODO: improve that statement
        const qry: string = "; WITH i AS (SELECT DISTINCT trace.tx_hash, trace.trace_position, trace.gas_used, transactions.tx_sender FROM transactions INNER JOIN trace ON trace.send_to = transactions.creates INNER JOIN votes ON transactions.tx_sender = votes.address AND votes.voted_for_proposal = $1 AND votes.poll_id = $2) SELECT SUM(b.gas_used) - SUM(a.gas_used) FROM (SELECT SUM(trace.gas_used) AS gas_used, trace.tx_hash AS tx_hash FROM i INNER JOIN trace ON i.tx_hash = trace.tx_hash AND i.trace_position = trace.parent_trace_position GROUP BY trace.tx_hash ) AS a INNER JOIN i AS b ON a.tx_hash = b.tx_hash";

        try {
            const dbResultRows = await this.dbPool.query(qry,[proposalId, pollId]);
            if(dbResultRows.rowCount > 0) {
                return parseInt(dbResultRows.rows[0].i);
            } else {
                return 0;
            }
        } catch (err) {
            throw "Unable to query database: " + err;
        }
    }

    public async getAddressesForProposal(pollId: number, proposalId: number) : Promise<string[]> {
        const addresses: string[] = [];
        const qry: string = 'SELECT address FROM votes WHERE poll_id = $1 AND voted_for_proposal = $2';
        try {
            const dbResultRows = await this.dbPool.query(qry,[pollId,proposalId]);
            dbResultRows.rows.forEach(row => {
                 addresses.push(row.address);
            });

        } catch (err) {
            throw "Unable to query database: " + err;
        }
        return addresses;
    }

}

export interface Vote {
    voteId: number,
    pollId: number,
    proposalId: number,
    timestamp: Date,
    voterAddress: string,
    message: string,
    isValid: boolean
}