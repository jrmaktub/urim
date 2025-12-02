use anchor_lang::prelude::*;

declare_id!("FdbThb8m8S3wcqowZwXxQGcunGM8pr5ib3i5mt3jKZbB");

#[program]
pub mod urim_solana {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
